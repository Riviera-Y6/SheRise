-- We-Rise production hardening: bounded Gemini usage and full PayFast subscription lifecycle.
-- Run after 0009_profile_photos_support.sql.

alter table public.payment_settings
  add column if not exists subscription_grace_days integer not null default 5
    check (subscription_grace_days between 0 and 30);

alter table public.member_profiles
  add column if not exists payfast_subscription_status varchar(30),
  add column if not exists subscription_status_updated_at timestamptz;

update public.member_profiles
set payfast_subscription_status = case
      when membership_status = 'active' and payfast_subscription_token is not null then 'active'
      when membership_status = 'cancelled' then 'cancelled'
      when membership_status in ('past_due', 'suspended') then membership_status
      else payfast_subscription_status
    end,
    subscription_status_updated_at = coalesce(subscription_status_updated_at, updated_at)
where payfast_subscription_status is null;

create or replace function public.sync_payfast_subscription_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payfast_subscription_token is not null then
    new.payfast_subscription_status := case
      when new.membership_status = 'active' then 'active'
      when new.membership_status in ('past_due', 'suspended', 'cancelled') then new.membership_status
      else new.payfast_subscription_status
    end;
    if new.payfast_subscription_status is distinct from old.payfast_subscription_status
       or new.membership_status is distinct from old.membership_status then
      new.subscription_status_updated_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_payfast_subscription_status_trigger on public.member_profiles;
create trigger sync_payfast_subscription_status_trigger
before update of membership_status, payfast_subscription_token on public.member_profiles
for each row execute function public.sync_payfast_subscription_status();

create table if not exists public.payment_notification_events (
  event_key char(64) primary key,
  provider varchar(30) not null default 'payfast' check (provider = 'payfast'),
  pf_payment_id varchar(120),
  subscription_token varchar(160),
  merchant_reference varchar(100),
  payment_status varchar(30) not null,
  member_key varchar(120) references public.member_profiles(member_key) on delete restrict,
  payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  processing_status varchar(20) not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  processing_error varchar(500),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payment_notification_member_idx
  on public.payment_notification_events(member_key, created_at desc);
create index if not exists payment_notification_pf_idx
  on public.payment_notification_events(pf_payment_id, created_at desc);

create or replace function public.record_payfast_status_event(
  p_event_key text,
  p_member_key text,
  p_transaction_id uuid,
  p_purpose text,
  p_merchant_reference text,
  p_pf_payment_id text,
  p_subscription_token text,
  p_payment_status text,
  p_payload jsonb,
  p_grace_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_payment_status, 'pending')));
  v_insert_count integer := 0;
  v_tx public.payment_transactions%rowtype;
  v_contribution public.backmi_contributions%rowtype;
  v_entry public.backmi_ledger_entries%rowtype;
begin
  if p_event_key is null or p_event_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid payment event key'; end if;
  if v_status not in ('pending', 'failed', 'cancelled', 'refunded', 'reversed') then raise exception 'Invalid payment event status'; end if;

  insert into public.payment_notification_events (
    event_key, pf_payment_id, subscription_token, merchant_reference, payment_status,
    member_key, payment_transaction_id, payload
  ) values (
    p_event_key, nullif(trim(coalesce(p_pf_payment_id, '')), ''),
    nullif(trim(coalesce(p_subscription_token, '')), ''),
    left(coalesce(p_merchant_reference, ''), 100), v_status,
    nullif(trim(coalesce(p_member_key, '')), ''), p_transaction_id, coalesce(p_payload, '{}'::jsonb)
  ) on conflict (event_key) do nothing;
  get diagnostics v_insert_count = row_count;

  if v_insert_count = 0 then
    return jsonb_build_object('success', true, 'duplicate', true);
  end if;

  if p_transaction_id is not null then
    select * into v_tx from public.payment_transactions where id = p_transaction_id for update;
    if found and (v_tx.status = 'pending' or v_status in ('refunded', 'reversed')) then
      update public.payment_transactions
      set status = v_status,
          provider_merchant_reference = coalesce(nullif(left(coalesce(p_merchant_reference, ''), 100), ''), provider_merchant_reference),
          payfast_payload = coalesce(p_payload, payfast_payload),
          updated_at = now()
      where id = v_tx.id;
    end if;
  end if;

  if p_member_key is not null and trim(p_member_key) <> '' then
    if v_status = 'cancelled' then
      update public.member_profiles
      set membership_status = 'cancelled',
          payfast_subscription_status = 'cancelled',
          subscription_cancelled_at = coalesce(subscription_cancelled_at, now()),
          subscription_grace_ends_at = null,
          subscription_status_updated_at = now(),
          updated_at = now()
      where member_key = p_member_key;
    elsif v_status = 'failed' and p_purpose = 'membership_recurring' then
      update public.member_profiles
      set membership_status = 'past_due',
          payfast_subscription_status = 'past_due',
          subscription_grace_ends_at = now() + make_interval(days => greatest(0, least(30, coalesce(p_grace_days, 5)))),
          subscription_status_updated_at = now(),
          updated_at = now()
      where member_key = p_member_key;
    elsif v_status in ('refunded', 'reversed') and p_purpose in ('membership_joining', 'membership_recurring') then
      update public.member_profiles
      set membership_status = 'suspended',
          payfast_subscription_status = v_status,
          subscription_grace_ends_at = null,
          subscription_status_updated_at = now(),
          updated_at = now()
      where member_key = p_member_key;
    end if;
  end if;

  if p_transaction_id is not null and v_status in ('refunded', 'reversed') then
    for v_entry in
      select original.* from public.backmi_ledger_entries original
      where original.payment_transaction_id = p_transaction_id
        and original.direction = 'credit'
        and not exists (
          select 1
          from public.backmi_ledger_entries correction
          where correction.payment_transaction_id = p_transaction_id
            and correction.direction = 'debit'
            and correction.entry_type in ('refund', 'reversal')
            and correction.metadata ->> 'original_ledger_entry_id' = original.id::text
        )
    loop
      insert into public.backmi_ledger_entries (
        event_key, entry_type, account, direction, amount_zar, payment_transaction_id,
        request_id, member_key, description, metadata
      ) values (
        p_event_key || ':' || v_entry.id::text,
        case when v_status = 'refunded' then 'refund' else 'reversal' end,
        v_entry.account, 'debit', v_entry.amount_zar, p_transaction_id,
        v_entry.request_id, v_entry.member_key,
        case when v_status = 'refunded' then 'Refund of verified PayFast credit' else 'Reversal of verified PayFast credit' end,
        jsonb_build_object('original_ledger_entry_id', v_entry.id, 'payfast_status', v_status)
      ) on conflict (event_key) do nothing;
    end loop;

    select * into v_contribution
    from public.backmi_contributions
    where payment_transaction_id = p_transaction_id
    for update;

    if found and v_contribution.contribution_status = 'confirmed' then
      update public.backmi_contributions
      set contribution_status = v_status,
          payout_status = 'reversed'
      where id = v_contribution.id;

      update public.campaigns
      set raised = greatest(0, raised - v_contribution.amount_zar),
          backers = greatest(0, backers - 1),
          status = case when status = 'target_reached' and greatest(0, raised - v_contribution.amount_zar) < goal then 'active' else status end
      where id = v_contribution.request_id;
    end if;
  end if;

  update public.payment_notification_events
  set processing_status = 'processed', processed_at = now()
  where event_key = p_event_key;

  return jsonb_build_object('success', true, 'duplicate', false, 'status', v_status);
exception
  when others then
    update public.payment_notification_events
    set processing_status = 'failed', processing_error = left(sqlerrm, 500), processed_at = now()
    where event_key = p_event_key;
    raise;
end;
$$;

-- AI content is deliberately not stored. Only usage metadata is retained for limits and audit.
create table if not exists public.ai_usage_events (
  request_id uuid primary key,
  member_key varchar(120) not null references public.member_profiles(member_key) on delete cascade,
  model varchar(100) not null,
  status varchar(30) not null default 'started'
    check (status in ('started', 'completed', 'redirected', 'blocked', 'failed')),
  category varchar(80),
  prompt_chars integer not null default 0 check (prompt_chars between 0 and 20000),
  output_chars integer not null default 0 check (output_chars between 0 and 10000),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code varchar(80),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_usage_member_day_idx
  on public.ai_usage_events(member_key, created_at desc);

create or replace function public.reserve_ai_request(
  p_member_key text,
  p_request_id uuid,
  p_model text,
  p_daily_limit integer,
  p_prompt_chars integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_limit integer := greatest(1, least(2000, coalesce(p_daily_limit, 1)));
  v_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_member_key is null or trim(p_member_key) = '' then raise exception 'Missing member key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_member_key, 0));

  select count(*)::integer into v_used
  from public.ai_usage_events
  where member_key = p_member_key and created_at >= v_day_start;

  if v_used >= v_limit then
    return jsonb_build_object('allowed', false, 'used_today', v_used, 'remaining', 0, 'daily_limit', v_limit);
  end if;

  insert into public.ai_usage_events (request_id, member_key, model, prompt_chars)
  values (p_request_id, p_member_key, left(coalesce(p_model, 'unknown'), 100), greatest(0, least(20000, coalesce(p_prompt_chars, 0))));

  return jsonb_build_object('allowed', true, 'used_today', v_used + 1, 'remaining', greatest(0, v_limit - v_used - 1), 'daily_limit', v_limit);
end;
$$;

revoke all on function public.record_payfast_status_event(text, text, uuid, text, text, text, text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.reserve_ai_request(text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_payfast_status_event(text, text, uuid, text, text, text, text, text, jsonb, integer) to service_role;
grant execute on function public.reserve_ai_request(text, uuid, text, integer, integer) to service_role;

alter table public.payment_notification_events enable row level security;
alter table public.ai_usage_events enable row level security;

-- No browser policies: only the Render API service role can read or write these tables.
