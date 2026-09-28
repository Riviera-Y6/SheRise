-- We-Rise: admin member removal support, 3-day trial, and richer new-member push notifications.
-- Run after 0014_admin_push_notifications.sql.

-- Capture member location at registration so admins can see where a new member joined from.
alter table public.member_profiles
  add column if not exists province varchar(80),
  add column if not exists city_town varchar(100),
  add column if not exists country varchar(80);

-- Keep the admin's preferred notification language with each browser/PWA subscription.
alter table public.admin_push_subscriptions
  add column if not exists locale varchar(5) not null default 'en';

-- Free trial is now 3 days. Existing trialing accounts are aligned to three days
-- from their original trial start; paid/active/cancelled accounts are not changed.
alter table public.payment_settings alter column trial_days set default 3;
update public.payment_settings set trial_days = 3 where id = 1;

alter table public.member_profiles
  alter column trial_ends_at set default (now() + interval '3 days');

update public.member_profiles
set trial_ends_at = trial_started_at + interval '3 days',
    updated_at = now()
where membership_status = 'trialing'
  and trial_started_at is not null
  and (trial_ends_at is null or trial_ends_at <> trial_started_at + interval '3 days');

-- New auth users inherit their registration location and the new 3-day trial.
create or replace function public.handle_new_we_rise_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_name text;
  configured_trial_days integer := 3;
  new_province text;
  new_city_town text;
  new_country text;
begin
  select trial_days into configured_trial_days from public.payment_settings where id = 1;
  configured_trial_days := coalesce(configured_trial_days, 3);
  new_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')), '');
  if new_name is null then new_name := split_part(coalesce(new.email, 'We-Rise Lady'), '@', 1); end if;
  new_province := nullif(trim(coalesce(new.raw_user_meta_data ->> 'province', '')), '');
  new_city_town := nullif(trim(coalesce(new.raw_user_meta_data ->> 'city_town', '')), '');
  new_country := nullif(trim(coalesce(new.raw_user_meta_data ->> 'country', '')), '');

  insert into public.member_profiles (
    member_key, auth_user_id, email, display_name, province, city_town, country, plan, role, membership_status,
    trial_started_at, trial_ends_at, created_at, updated_at, last_seen_at
  ) values (
    new.id::text,
    new.id,
    lower(new.email),
    left(new_name, 80),
    left(new_province, 80),
    left(new_city_town, 100),
    left(new_country, 80),
    'free',
    'member',
    'trialing',
    now(),
    now() + make_interval(days => configured_trial_days),
    now(),
    now(),
    now()
  )
  on conflict (member_key) do update
    set auth_user_id = excluded.auth_user_id,
        email = excluded.email,
        province = coalesce(public.member_profiles.province, excluded.province),
        city_town = coalesce(public.member_profiles.city_town, excluded.city_town),
        country = coalesce(public.member_profiles.country, excluded.country),
        updated_at = now();
  return new;
end;
$$;

-- If someone was on the waitlist before registering, preserve that known location
-- on the member profile before automatically removing the waitlist row.
create or replace function public.remove_new_member_from_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wait_province text;
  wait_city text;
  wait_country text;
begin
  if new.email is not null then
    select province, city_town, country
      into wait_province, wait_city, wait_country
    from public.waitlist_entries
    where lower(email) = lower(new.email)
    order by created_at desc
    limit 1;

    if wait_province is not null or wait_city is not null or wait_country is not null then
      update public.member_profiles
      set province = coalesce(province, wait_province),
          city_town = coalesce(city_town, wait_city),
          country = coalesce(country, wait_country),
          updated_at = now()
      where member_key = new.member_key;
    end if;

    delete from public.waitlist_entries
    where lower(email) = lower(new.email);
  end if;
  return new;
end;
$$;
