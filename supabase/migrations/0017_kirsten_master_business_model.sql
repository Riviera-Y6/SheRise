-- We-Rise Kirsten master business model (Oct 2026)
-- R194 joining, R166 membership, R10 BackMi, R33 VulDit/Fuel-It, R123 operating.
-- RentIt/HuurDit: R1800 activation + R800/month infrastructure + R1000 qualifying sales commission.

alter table public.payment_settings
  add column if not exists fuelit_allocation_zar numeric(12,2) not null default 33
    check (fuelit_allocation_zar >= 0);

update public.payment_settings
set joining_fee_zar = 194,
    monthly_fee_zar = 166,
    backmi_allocation_zar = 10,
    backmi_allocation_mode = 'fixed',
    fuelit_allocation_zar = 33,
    subscription_grace_days = 5,
    updated_at = now()
where id = 1;

alter table public.referral_program_settings
  add column if not exists monthly_fee_zar numeric(12,2) not null default 0
    check (monthly_fee_zar >= 0);

update public.referral_program_settings
set activation_fee_zar = 1800,
    referral_earning_zar = 1000,
    monthly_fee_zar = 800,
    qualifying_payment_purpose = 'huurdit_activation',
    updated_at = now()
where program_type = 'huurdit';

alter table public.member_profiles
  add column if not exists paystack_subaccount_code varchar(160);

alter table public.referral_programs
  add column if not exists subscription_code varchar(160),
  add column if not exists subscription_email_token varchar(160),
  add column if not exists subscription_customer_code varchar(160),
  add column if not exists subscription_authorization_code varchar(160),
  add column if not exists subscription_status varchar(40),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_next_billing_date date,
  add column if not exists subscription_grace_ends_at timestamptz,
  add column if not exists subscription_cancelled_at timestamptz;

create unique index if not exists referral_programs_subscription_code_idx
  on public.referral_programs(subscription_code)
  where subscription_code is not null;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_purpose_check;
alter table public.payment_transactions
  add constraint payment_transactions_purpose_check
  check (purpose in ('membership_joining', 'membership_recurring', 'backmi_gift', 'huurdit_activation', 'huurdit_recurring'));

alter table public.backmi_ledger_entries
  drop constraint if exists backmi_ledger_entries_entry_type_check;
alter table public.backmi_ledger_entries
  add constraint backmi_ledger_entries_entry_type_check
  check (entry_type in (
    'membership_joining', 'membership_revenue', 'backmi_foundation_allocation',
    'fuelit_credit_allocation', 'fuelit_platform_credit', 'voluntary_gift',
    'payfast_fee', 'paystack_fee', 'refund', 'reversal', 'payout'
  ));

alter table public.backmi_ledger_entries
  drop constraint if exists backmi_ledger_entries_account_check;
alter table public.backmi_ledger_entries
  add constraint backmi_ledger_entries_account_check
  check (account in (
    'we_rise_operating', 'backmi_foundation', 'fuelit_credit_pool',
    'backmi_request_payable', 'payfast_fees', 'paystack_fees', 'refunds', 'payouts'
  ));

create table if not exists public.fuelit_credit_entries (
  id uuid primary key default gen_random_uuid(),
  member_key varchar(120) not null references public.member_profiles(member_key) on delete restrict,
  source_member_key varchar(120) references public.member_profiles(member_key) on delete set null,
  payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
  direction varchar(10) not null check (direction in ('credit','debit')),
  amount_zar numeric(12,2) not null check (amount_zar > 0),
  entry_type varchar(30) not null check (entry_type in ('referral_credit','platform_fee_credit','payout','void')),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fuelit_credit_entries_member_idx
  on public.fuelit_credit_entries(member_key, created_at desc);
create unique index if not exists fuelit_referral_payment_once_idx
  on public.fuelit_credit_entries(payment_transaction_id, entry_type)
  where payment_transaction_id is not null and entry_type = 'referral_credit';
create unique index if not exists fuelit_platform_payment_once_idx
  on public.fuelit_credit_entries(payment_transaction_id, member_key, entry_type)
  where payment_transaction_id is not null and entry_type = 'platform_fee_credit';

alter table public.fuelit_credit_entries enable row level security;
revoke all on table public.fuelit_credit_entries from public, anon, authenticated;
grant all on table public.fuelit_credit_entries to service_role;
