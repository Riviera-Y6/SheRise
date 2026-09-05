-- We-Rise: mandatory member profile photos + direct support tickets.
-- Run after 0008_payfast_backmi.sql.

create extension if not exists pgcrypto;

alter table public.member_profiles
  add column if not exists avatar_path text,
  add column if not exists avatar_updated_at timestamptz,
  add column if not exists profile_photo_completed_at timestamptz;

create index if not exists member_profiles_avatar_idx
  on public.member_profiles(member_key)
  where avatar_path is not null;

-- Both buckets remain private. Render is the only storage gateway and returns
-- short-lived signed avatar links only to authenticated, profile-complete members.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'we-rise-profile-photos',
  'we-rise-profile-photos',
  false,
  2097152,
  array['image/jpeg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'we-rise-support-attachments',
  'we-rise-support-attachments',
  false,
  4194304,
  array['image/jpeg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.support_ticket_counters (
  ticket_year integer primary key,
  last_value bigint not null default 0 check (last_value >= 0)
);

create or replace function public.next_support_ticket_code(p_created_at timestamptz default now())
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from coalesce(p_created_at, now()))::integer;
  v_number bigint;
begin
  insert into public.support_ticket_counters (ticket_year, last_value)
  values (v_year, 1)
  on conflict (ticket_year) do update
    set last_value = public.support_ticket_counters.last_value + 1
  returning last_value into v_number;

  return 'SUPPORT-' || v_year::text || '-' || lpad(v_number::text, 6, '0');
end;
$$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code varchar(32) not null unique,
  member_key varchar(120) references public.member_profiles(member_key) on delete set null,
  requester_name varchar(80) not null,
  requester_email varchar(320) not null,
  category varchar(40) not null check (category in (
    'account', 'profile_photo', 'technical', 'membership_payment',
    'backmi', 'community_messages', 'safety', 'other'
  )),
  subject varchar(140) not null,
  message text not null check (char_length(message) between 10 and 4000),
  attachment_path text,
  page_context varchar(240),
  status varchar(30) not null default 'new' check (status in ('new', 'open', 'waiting', 'resolved', 'closed')),
  email_status varchar(30) not null default 'pending' check (email_status in ('pending', 'sent', 'failed', 'disabled')),
  email_provider_id varchar(240),
  email_error varchar(500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_created_idx on public.support_tickets(created_at desc);
create index if not exists support_tickets_member_idx on public.support_tickets(member_key, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status, created_at desc);
create index if not exists support_tickets_email_idx on public.support_tickets(lower(requester_email), created_at desc);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_counters enable row level security;

-- No browser policies are created. The authenticated Render API remains the
-- server-side gateway for profile photos and support tickets.
revoke all on function public.next_support_ticket_code(timestamptz) from public;
revoke all on function public.next_support_ticket_code(timestamptz) from anon;
revoke all on function public.next_support_ticket_code(timestamptz) from authenticated;
grant execute on function public.next_support_ticket_code(timestamptz) to service_role;
