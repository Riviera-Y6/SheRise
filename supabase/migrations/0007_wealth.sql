-- We-Rise Welvaart: member-owned financial resilience profile
-- Run once in Supabase SQL Editor after 0006_supabase_auth.sql.

create table if not exists public.wealth_profiles (
  member_key varchar(120) primary key references public.member_profiles(member_key) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wealth_profiles_updated_idx on public.wealth_profiles(updated_at desc);

alter table public.wealth_profiles enable row level security;

-- No browser RLS policies are added intentionally.
-- The authenticated Render API remains the gateway and uses the server-side Supabase secret.
