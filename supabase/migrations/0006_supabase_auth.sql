-- We-Rise Phase 3: Supabase Auth + real member ownership
-- Run this ONCE in Supabase SQL Editor after the earlier We-Rise schema/migrations.

alter table public.member_profiles
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade,
  add column if not exists email varchar(320);

create index if not exists member_profiles_auth_user_idx on public.member_profiles(auth_user_id);
create index if not exists member_profiles_email_idx on public.member_profiles(lower(email));

alter table public.campaigns
  add column if not exists creator_user_id uuid references auth.users(id) on delete set null;

alter table public.donations
  add column if not exists donor_user_id uuid references auth.users(id) on delete set null;

alter table public.community_topics
  add column if not exists author_user_id uuid references auth.users(id) on delete set null;

alter table public.community_comments
  add column if not exists author_user_id uuid references auth.users(id) on delete set null;

-- Create a member profile automatically whenever a Supabase Auth account is created.
create or replace function public.handle_new_we_rise_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_name text;
begin
  new_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')), '');
  if new_name is null then
    new_name := split_part(coalesce(new.email, 'We-Rise Lady'), '@', 1);
  end if;

  insert into public.member_profiles (
    member_key,
    auth_user_id,
    email,
    display_name,
    plan,
    created_at,
    updated_at,
    last_seen_at
  ) values (
    new.id::text,
    new.id,
    lower(new.email),
    left(new_name, 80),
    'free',
    now(),
    now(),
    now()
  )
  on conflict (member_key) do update set
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_we_rise on auth.users;
create trigger on_auth_user_created_we_rise
after insert on auth.users
for each row execute procedure public.handle_new_we_rise_user();

-- Auth-aware atomic donation function. The legacy 3-argument function may remain
-- temporarily so an older deployment does not break during rollout.
create or replace function public.record_donation(
  p_campaign_id uuid,
  p_donor text,
  p_amount numeric,
  p_donor_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Donation amount must be positive';
  end if;

  if not exists (select 1 from public.campaigns where id = p_campaign_id) then
    return false;
  end if;

  insert into public.donations (campaign_id, donor, donor_user_id, amount)
  values (
    p_campaign_id,
    coalesce(nullif(trim(p_donor), ''), 'Anonymous'),
    p_donor_user_id,
    p_amount
  );

  update public.campaigns
  set raised = raised + p_amount,
      backers = backers + 1
  where id = p_campaign_id;

  return true;
end;
$$;

-- Browser clients still do not receive table access. Render remains the data gateway.
alter table public.member_profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.donations enable row level security;
alter table public.community_topics enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_supports enable row level security;
alter table public.private_conversations enable row level security;
alter table public.private_messages enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.emergency_alerts enable row level security;
alter table public.emergency_alert_recipients enable row level security;
