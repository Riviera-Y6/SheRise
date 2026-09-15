-- We-Rise Paystack provider migration.
-- Keeps the existing audited financial model intact while switching new checkouts/subscriptions to Paystack.

alter table public.member_profiles
  add column if not exists paystack_customer_code varchar(160),
  add column if not exists paystack_authorization_code varchar(160),
  add column if not exists paystack_email_token varchar(160);

-- Existing PayFast-era subscription columns are intentionally retained for backwards compatibility.
-- For new Paystack memberships, payfast_subscription_token stores the Paystack SUB_ code and
-- payfast_subscription_status stores the generic recurring status used by the existing membership model.

alter table public.payment_notification_events
  drop constraint if exists payment_notification_events_provider_check;
alter table public.payment_notification_events
  add constraint payment_notification_events_provider_check check (provider in ('payfast', 'paystack'));

alter table public.backmi_ledger_entries
  drop constraint if exists backmi_ledger_entries_entry_type_check;
alter table public.backmi_ledger_entries
  add constraint backmi_ledger_entries_entry_type_check check (entry_type in ('membership_joining', 'membership_revenue', 'backmi_foundation_allocation', 'voluntary_gift', 'payfast_fee', 'paystack_fee', 'refund', 'reversal', 'payout'));

alter table public.backmi_ledger_entries
  drop constraint if exists backmi_ledger_entries_account_check;
alter table public.backmi_ledger_entries
  add constraint backmi_ledger_entries_account_check check (account in ('we_rise_operating', 'backmi_foundation', 'backmi_request_payable', 'payfast_fees', 'paystack_fees', 'refunds', 'payouts'));

create or replace function public.finalize_paystack_payment(
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
  if p_pf_payment_id is null or trim(p_pf_payment_id) = '' then raise exception 'Missing Paystack payment id'; end if;
  if p_amount_gross is null or p_amount_gross <= 0 then raise exception 'Invalid Paystack amount'; end if;

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

    if not found then raise exception 'Unknown Paystack payment reference'; end if;
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
    if abs(v_tx.expected_amount_zar - p_amount_gross) > 0.01 then raise exception 'Paystack amount mismatch'; end if;
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

  if abs(v_tx.expected_amount_zar - p_amount_gross) > 0.01 then raise exception 'Paystack amount mismatch'; end if;
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
      trim(p_pf_payment_id) || ':fee', 'paystack_fee', 'paystack_fees', 'debit', v_fee,
      v_tx.id, v_tx.request_id, v_tx.member_key, 'Paystack transaction fee reported with verified payment'
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


create or replace function public.record_paystack_status_event(
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
    event_key, provider, pf_payment_id, subscription_token, merchant_reference, payment_status,
    member_key, payment_transaction_id, payload
  ) values (
    p_event_key, 'paystack', nullif(trim(coalesce(p_pf_payment_id, '')), ''),
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
        case when v_status = 'refunded' then 'Refund of verified Paystack credit' else 'Reversal of verified Paystack credit' end,
        jsonb_build_object('original_ledger_entry_id', v_entry.id, 'paystack_status', v_status)
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


revoke all on function public.finalize_paystack_payment(text, text, numeric, numeric, numeric, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_paystack_payment(text, text, numeric, numeric, numeric, text, date, jsonb) to service_role;

revoke all on function public.record_paystack_status_event(text, text, uuid, text, text, text, text, text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.record_paystack_status_event(text, text, uuid, text, text, text, text, text, jsonb, integer) to service_role;
