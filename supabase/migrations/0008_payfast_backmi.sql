-- We-Rise & BackMi: trials, PayFast payments, verified gifts and audit ledger.
-- Run after 0007_wealth.sql. Final BackMi payouts are intentionally NOT implemented.

create extension if not exists pgcrypto;

-- Business values live in data, not application code. One row is active at a time.
create table if not exists public.payment_settings (
  id smallint primary key default 1 check (id = 1),
  trial_days integer not null default 7 check (trial_days between 1 and 90),
  joining_fee_usd numeric(12,2) not null default 12 check (joining_fee_usd >= 0),
  joining_fee_zar numeric(12,2) not null default 194 check (joining_fee_zar > 0),
  monthly_fee_usd numeric(12,2) not null default 10 check (monthly_fee_usd >= 0),
  monthly_fee_zar numeric(12,2) not null default 166 check (monthly_fee_zar > 0),
  backmi_allocation_usd numeric(12,2) not null default 2 check (backmi_allocation_usd >= 0),
  backmi_allocation_zar numeric(12,2) not null default 33 check (backmi_allocation_zar >= 0),
  backmi_allocation_mode varchar(20) not null default 'fixed' check (backmi_allocation_mode in ('fixed', 'percentage')),
  backmi_allocation_percentage numeric(6,3) not null default 20 check (backmi_allocation_percentage between 0 and 100),
  allocation_fee_basis varchar(10) not null default 'gross' check (allocation_fee_basis in ('gross', 'net')),
  first_recurring_delay_days integer not null default 30 check (first_recurring_delay_days between 1 and 365),
  minimum_gift_zar numeric(12,2) not null default 10 check (minimum_gift_zar > 0),
  maximum_gift_zar numeric(12,2) not null default 100000 check (maximum_gift_zar >= minimum_gift_zar),
  membership_payments_enabled boolean not null default true,
  backmi_gifts_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by_member_key varchar(120)
);

insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

alter table public.member_profiles
  add column if not exists role varchar(30) not null default 'member',
  add column if not exists membership_status varchar(30) not null default 'trialing',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists joining_paid_at timestamptz,
  add column if not exists payfast_subscription_token varchar(160),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_next_billing_date date,
  add column if not exists subscription_cancelled_at timestamptz,
  add column if not exists subscription_monthly_amount_zar numeric(12,2),
  add column if not exists subscription_grace_ends_at timestamptz;

alter table public.member_profiles alter column trial_started_at set default now();
alter table public.member_profiles alter column trial_ends_at set default (now() + interval '7 days');

-- Keep the Auth trigger aligned with the configurable trial duration. Existing
-- profiles keep their original trial dates; only genuinely new members receive a new trial.
create or replace function public.handle_new_we_rise_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_name text;
  configured_trial_days integer := 7;
begin
  select trial_days into configured_trial_days from public.payment_settings where id = 1;
  configured_trial_days := coalesce(configured_trial_days, 7);
  new_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')), '');
  if new_name is null then new_name := split_part(coalesce(new.email, 'We-Rise Lady'), '@', 1); end if;

  insert into public.member_profiles (
    member_key, auth_user_id, email, display_name, plan, role, membership_status,
    trial_started_at, trial_ends_at, created_at, updated_at, last_seen_at
  ) values (
    new.id::text, new.id, lower(new.email), left(new_name, 80), 'free', 'member', 'trialing',
    now(), now() + make_interval(days => configured_trial_days), now(), now(), now()
  )
  on conflict (member_key) do update
    set auth_user_id = excluded.auth_user_id,
        email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

update public.member_profiles
set trial_started_at = coalesce(trial_started_at, now()),
    trial_ends_at = coalesce(trial_ends_at, now() + interval '7 days'),
    membership_status = case when plan = 'premium' then 'active' else coalesce(nullif(membership_status, ''), 'trialing') end
where trial_started_at is null or trial_ends_at is null or membership_status is null or membership_status = '' or plan = 'premium';

create unique index if not exists member_profiles_payfast_token_unique
  on public.member_profiles(payfast_subscription_token)
  where payfast_subscription_token is not null;
create index if not exists member_profiles_membership_status_idx on public.member_profiles(membership_status, trial_ends_at);
create index if not exists member_profiles_role_idx on public.member_profiles(role);

-- Public BackMi request numbers are generated on the server/database, never in the browser.
create table if not exists public.backmi_request_counters (
  request_year integer primary key,
  last_value bigint not null default 0 check (last_value >= 0)
);

create or replace function public.next_backmi_request_code(p_created_at timestamptz default now())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from coalesce(p_created_at, now()))::integer;
  v_number bigint;
begin
  insert into public.backmi_request_counters (request_year, last_value)
  values (v_year, 1)
  on conflict (request_year) do update
    set last_value = public.backmi_request_counters.last_value + 1
  returning last_value into v_number;

  return 'BACKMI-' || v_year::text || '-' || lpad(v_number::text, 6, '0');
end;
$$;

alter table public.campaigns
  add column if not exists request_code varchar(32),
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_member_key varchar(120),
  add column if not exists review_notes text,
  add column if not exists maturity_date date,
  add column if not exists approved_at timestamptz,
  add column if not exists payout_status varchar(30) not null default 'not_ready';

alter table public.campaigns alter column status set default 'pending_review';

update public.campaigns
set request_code = public.next_backmi_request_code(created_at)
where request_code is null;

-- Existing prototype pledges were not PayFast-confirmed, so they are retained for audit
-- in the legacy donations table but may not count as real money.
update public.campaigns
set raised = 0,
    backers = 0,
    status = 'pending_review',
    submitted_at = coalesce(submitted_at, created_at),
    payout_status = 'not_ready';

create unique index if not exists campaigns_request_code_unique on public.campaigns(request_code);
create index if not exists campaigns_review_queue_idx on public.campaigns(status, submitted_at desc);
create index if not exists campaigns_creator_user_idx on public.campaigns(creator_user_id, submitted_at desc);

create or replace function public.assign_backmi_request_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.request_code is null or trim(new.request_code) = '' then
    new.request_code := public.next_backmi_request_code(coalesce(new.created_at, now()));
  end if;
  new.submitted_at := coalesce(new.submitted_at, now());
  new.status := coalesce(nullif(new.status, ''), 'pending_review');
  return new;
end;
$$;

drop trigger if exists assign_backmi_request_code_trigger on public.campaigns;
create trigger assign_backmi_request_code_trigger
before insert on public.campaigns
for each row execute function public.assign_backmi_request_code();

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  member_key varchar(120) not null references public.member_profiles(member_key) on delete restrict,
  purpose varchar(40) not null check (purpose in ('membership_joining', 'membership_recurring', 'backmi_gift')),
  request_id uuid references public.campaigns(id) on delete restrict,
  checkout_reference varchar(100) unique,
  provider_merchant_reference varchar(100),
  pf_payment_id varchar(120) unique,
  subscription_token varchar(160),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  expected_amount_zar numeric(12,2) not null check (expected_amount_zar > 0),
  amount_gross_zar numeric(12,2),
  amount_fee_zar numeric(12,2),
  amount_net_zar numeric(12,2),
  item_name varchar(120) not null,
  status varchar(30) not null default 'pending' check (status in ('pending', 'complete', 'failed', 'cancelled', 'refunded', 'reversed')),
  metadata jsonb not null default '{}'::jsonb,
  payfast_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);
create index if not exists payment_transactions_member_idx on public.payment_transactions(member_key, created_at desc);
create index if not exists payment_transactions_request_idx on public.payment_transactions(request_id, created_at desc);
create index if not exists payment_transactions_token_idx on public.payment_transactions(subscription_token, created_at desc);

create table if not exists public.backmi_request_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.campaigns(id) on delete cascade,
  member_key varchar(120) not null references public.member_profiles(member_key) on delete cascade,
  object_path text not null unique,
  file_name varchar(240) not null,
  mime_type varchar(120) not null,
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now()
);
create index if not exists backmi_documents_request_idx on public.backmi_request_documents(request_id, created_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backmi-evidence', 'backmi-evidence', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

create table if not exists public.backmi_contributions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.campaigns(id) on delete restrict,
  donor_member_key varchar(120) not null references public.member_profiles(member_key) on delete restrict,
  payment_transaction_id uuid not null unique references public.payment_transactions(id) on delete restrict,
  amount_zar numeric(12,2) not null check (amount_zar > 0),
  contribution_status varchar(30) not null default 'confirmed' check (contribution_status in ('confirmed', 'refunded', 'reversed')),
  maturity_date date,
  payout_status varchar(30) not null default 'held' check (payout_status in ('held', 'matured', 'payout_pending', 'paid', 'reversed')),
  created_at timestamptz not null default now()
);
create index if not exists backmi_contributions_request_idx on public.backmi_contributions(request_id, created_at desc);
create index if not exists backmi_contributions_donor_idx on public.backmi_contributions(donor_member_key, created_at desc);

create table if not exists public.backmi_ledger_entries (
  id bigint generated by default as identity primary key,
  event_key varchar(220) not null unique,
  entry_type varchar(50) not null check (entry_type in ('membership_joining', 'membership_revenue', 'backmi_foundation_allocation', 'voluntary_gift', 'payfast_fee', 'refund', 'reversal', 'payout')),
  account varchar(60) not null check (account in ('we_rise_operating', 'backmi_foundation', 'backmi_request_payable', 'payfast_fees', 'refunds', 'payouts')),
  direction varchar(10) not null check (direction in ('credit', 'debit')),
  amount_zar numeric(12,2) not null check (amount_zar > 0),
  payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
  request_id uuid references public.campaigns(id) on delete restrict,
  member_key varchar(120) references public.member_profiles(member_key) on delete restrict,
  description varchar(300) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists backmi_ledger_payment_idx on public.backmi_ledger_entries(payment_transaction_id, created_at);
create index if not exists backmi_ledger_request_idx on public.backmi_ledger_entries(request_id, created_at);
create index if not exists backmi_ledger_account_idx on public.backmi_ledger_entries(account, created_at desc);

create or replace function public.get_backmi_ledger_balances()
returns table (account varchar, balance_zar numeric)
language sql
security definer
set search_path = public
as $$
  select entry.account,
         coalesce(sum(case when entry.direction = 'credit' then entry.amount_zar else -entry.amount_zar end), 0)::numeric
  from public.backmi_ledger_entries entry
  group by entry.account
  order by entry.account;
$$;

-- Finalise one verified PayFast payment atomically. A unique PayFast id and event keys
-- make repeated ITNs safe. Only confirmed gifts update public BackMi totals.
create or replace function public.finalize_payfast_payment(
  p_merchant_reference text,
  p_pf_payment_id text,
  p_amount_gross numeric,
  p_amount_fee numeric,
  p_amount_net numeric,
  p_subscription_token text,
  p_billing_date date,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_existing public.payment_transactions%rowtype;
  v_member public.member_profiles%rowtype;
  v_request public.campaigns%rowtype;
  v_settings public.payment_settings%rowtype;
  v_fee numeric(12,2) := abs(coalesce(p_amount_fee, 0));
  v_net numeric(12,2) := coalesce(p_amount_net, greatest(0, p_amount_gross - abs(coalesce(p_amount_fee, 0))));
  v_allocation numeric(12,2) := 0;
  v_allocation_base numeric(12,2) := 0;
  v_remainder numeric(12,2) := 0;
begin
  if p_pf_payment_id is null or trim(p_pf_payment_id) = '' then raise exception 'Missing PayFast payment id'; end if;
  if p_amount_gross is null or p_amount_gross <= 0 then raise exception 'Invalid PayFast amount'; end if;

  select * into v_existing
  from public.payment_transactions
  where pf_payment_id = trim(p_pf_payment_id)
  for update;

  if found and v_existing.status = 'complete' then
    return jsonb_build_object('success', true, 'duplicate', true, 'transaction_id', v_existing.id, 'purpose', v_existing.purpose);
  end if;

  select * into v_tx
  from public.payment_transactions
  where checkout_reference = nullif(trim(coalesce(p_merchant_reference, '')), '')
    and status = 'pending'
  for update;

  if not found then
    select * into v_member
    from public.member_profiles
    where payfast_subscription_token = nullif(trim(coalesce(p_subscription_token, '')), '')
    for update;

    if not found then raise exception 'Unknown PayFast payment reference'; end if;
    if v_member.subscription_monthly_amount_zar is null or v_member.subscription_monthly_amount_zar <= 0 then
      raise exception 'Subscription amount is not configured';
    end if;

    insert into public.payment_transactions (
      member_key, purpose, provider_merchant_reference, pf_payment_id, subscription_token,
      expected_amount_zar, amount_gross_zar, amount_fee_zar, amount_net_zar,
      item_name, status, metadata, payfast_payload, verified_at
    ) values (
      v_member.member_key, 'membership_recurring', left(coalesce(p_merchant_reference, ''), 100), trim(p_pf_payment_id),
      nullif(trim(coalesce(p_subscription_token, '')), ''), v_member.subscription_monthly_amount_zar,
      p_amount_gross, v_fee, v_net, 'We-Rise Monthly Membership', 'complete', '{}'::jsonb, p_payload, now()
    ) returning * into v_tx;
  else
    if abs(v_tx.expected_amount_zar - p_amount_gross) > 0.01 then raise exception 'PayFast amount mismatch'; end if;
    update public.payment_transactions
    set provider_merchant_reference = left(coalesce(p_merchant_reference, ''), 100),
        pf_payment_id = trim(p_pf_payment_id),
        subscription_token = coalesce(nullif(trim(coalesce(p_subscription_token, '')), ''), subscription_token),
        amount_gross_zar = p_amount_gross,
        amount_fee_zar = v_fee,
        amount_net_zar = v_net,
        status = 'complete',
        payfast_payload = p_payload,
        verified_at = now(),
        updated_at = now()
    where id = v_tx.id
    returning * into v_tx;

    select * into v_member from public.member_profiles where member_key = v_tx.member_key for update;
  end if;

  if abs(v_tx.expected_amount_zar - p_amount_gross) > 0.01 then raise exception 'PayFast amount mismatch'; end if;
  select * into v_settings from public.payment_settings where id = 1;

  if v_tx.purpose = 'membership_joining' then
    update public.member_profiles
    set plan = 'premium',
        membership_status = 'active',
        joining_paid_at = coalesce(joining_paid_at, now()),
        payfast_subscription_token = coalesce(nullif(trim(coalesce(p_subscription_token, '')), ''), payfast_subscription_token),
        subscription_started_at = coalesce(subscription_started_at, now()),
        subscription_next_billing_date = coalesce(p_billing_date, nullif(v_tx.metadata ->> 'first_billing_date', '')::date, subscription_next_billing_date),
        subscription_monthly_amount_zar = coalesce((v_tx.metadata ->> 'monthly_fee_zar')::numeric, v_settings.monthly_fee_zar),
        subscription_cancelled_at = null,
        subscription_grace_ends_at = null,
        updated_at = now()
    where member_key = v_tx.member_key;

    insert into public.backmi_ledger_entries (
      event_key, entry_type, account, direction, amount_zar, payment_transaction_id, member_key, description
    ) values (
      trim(p_pf_payment_id) || ':joining', 'membership_joining', 'we_rise_operating', 'credit', p_amount_gross,
      v_tx.id, v_tx.member_key, 'Verified one-time We-Rise joining payment'
    ) on conflict (event_key) do nothing;

  elsif v_tx.purpose = 'membership_recurring' then
    update public.member_profiles
    set plan = 'premium',
        membership_status = 'active',
        payfast_subscription_token = coalesce(nullif(trim(coalesce(p_subscription_token, '')), ''), payfast_subscription_token),
        subscription_next_billing_date = (coalesce(p_billing_date, current_date) + interval '1 month')::date,
        subscription_cancelled_at = null,
        subscription_grace_ends_at = null,
        updated_at = now()
    where member_key = v_tx.member_key;

    v_allocation_base := case when v_settings.allocation_fee_basis = 'net' then v_net else p_amount_gross end;
    v_allocation := case
      when v_settings.backmi_allocation_mode = 'percentage'
        then round(v_allocation_base * v_settings.backmi_allocation_percentage / 100, 2)
      else v_settings.backmi_allocation_zar
    end;
    v_allocation := least(greatest(v_allocation, 0), p_amount_gross);
    v_remainder := greatest(0, p_amount_gross - v_allocation);

    if v_remainder > 0 then
      insert into public.backmi_ledger_entries (
        event_key, entry_type, account, direction, amount_zar, payment_transaction_id, member_key, description
      ) values (
        trim(p_pf_payment_id) || ':membership', 'membership_revenue', 'we_rise_operating', 'credit', v_remainder,
        v_tx.id, v_tx.member_key, 'Verified recurring We-Rise membership amount after BackMi allocation'
      ) on conflict (event_key) do nothing;
    end if;

    if v_allocation > 0 then
      insert into public.backmi_ledger_entries (
        event_key, entry_type, account, direction, amount_zar, payment_transaction_id, member_key, description,
        metadata
      ) values (
        trim(p_pf_payment_id) || ':backmi-foundation', 'backmi_foundation_allocation', 'backmi_foundation', 'credit', v_allocation,
        v_tx.id, v_tx.member_key, 'BackMi allocation from verified monthly membership',
        jsonb_build_object('mode', v_settings.backmi_allocation_mode, 'fee_basis', v_settings.allocation_fee_basis)
      ) on conflict (event_key) do nothing;
    end if;

  elsif v_tx.purpose = 'backmi_gift' then
    select * into v_request from public.campaigns where id = v_tx.request_id for update;
    if not found then raise exception 'BackMi request not found'; end if;

    insert into public.backmi_contributions (
      request_id, donor_member_key, payment_transaction_id, amount_zar, maturity_date
    ) values (
      v_request.id, v_tx.member_key, v_tx.id, p_amount_gross, v_request.maturity_date
    ) on conflict (payment_transaction_id) do nothing;

    update public.campaigns
    set raised = raised + p_amount_gross,
        backers = backers + 1,
        status = case when raised + p_amount_gross >= goal then 'target_reached' else status end
    where id = v_request.id
      and not exists (
        select 1 from public.backmi_ledger_entries where event_key = trim(p_pf_payment_id) || ':gift'
      );

    insert into public.backmi_ledger_entries (
      event_key, entry_type, account, direction, amount_zar, payment_transaction_id, request_id, member_key, description
    ) values (
      trim(p_pf_payment_id) || ':gift', 'voluntary_gift', 'backmi_request_payable', 'credit', p_amount_gross,
      v_tx.id, v_request.id, v_tx.member_key, 'Verified voluntary gift to approved BackMi request'
    ) on conflict (event_key) do nothing;
  end if;

  if v_fee > 0 then
    insert into public.backmi_ledger_entries (
      event_key, entry_type, account, direction, amount_zar, payment_transaction_id, request_id, member_key, description
    ) values (
      trim(p_pf_payment_id) || ':fee', 'payfast_fee', 'payfast_fees', 'debit', v_fee,
      v_tx.id, v_tx.request_id, v_tx.member_key, 'PayFast transaction fee reported with verified payment'
    ) on conflict (event_key) do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'transaction_id', v_tx.id,
    'purpose', v_tx.purpose,
    'backmi_allocation_zar', v_allocation
  );
exception
  when unique_violation then
    select * into v_existing from public.payment_transactions where pf_payment_id = trim(p_pf_payment_id);
    if found then
      return jsonb_build_object('success', true, 'duplicate', true, 'transaction_id', v_existing.id, 'purpose', v_existing.purpose);
    end if;
    raise;
end;
$$;

-- Prototype pledge functions are deliberately removed. Money may only be counted
-- by finalize_payfast_payment after server-side PayFast verification.
drop function if exists public.record_donation(uuid, text, numeric);
drop function if exists public.record_donation(uuid, text, numeric, uuid);

revoke all on function public.next_backmi_request_code(timestamptz) from public, anon, authenticated;
revoke all on function public.assign_backmi_request_code() from public, anon, authenticated;
revoke all on function public.get_backmi_ledger_balances() from public, anon, authenticated;
revoke all on function public.finalize_payfast_payment(text, text, numeric, numeric, numeric, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.next_backmi_request_code(timestamptz) to service_role;
grant execute on function public.assign_backmi_request_code() to service_role;
grant execute on function public.get_backmi_ledger_balances() to service_role;
grant execute on function public.finalize_payfast_payment(text, text, numeric, numeric, numeric, text, date, jsonb) to service_role;

alter table public.payment_settings enable row level security;
alter table public.backmi_request_counters enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.backmi_request_documents enable row level security;
alter table public.backmi_contributions enable row level security;
alter table public.backmi_ledger_entries enable row level security;

-- No browser policies are added. Render, using the server-only service role,
-- remains the sole gateway for membership, evidence and financial data.
