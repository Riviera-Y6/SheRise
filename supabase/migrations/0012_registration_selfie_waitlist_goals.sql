-- We-Rise: permanent registration selfies + updated waitlist location fields.
-- Run after 0011_paystack_payments.sql.

-- Waitlist location fields requested for future onboarding.
alter table public.waitlist_entries
  add column if not exists province varchar(80),
  add column if not exists city_town varchar(100);

-- Historical waitlist rows may still contain a reason, but new submissions use
-- province/city/country instead. Keep the old column for audit/history only.
alter table public.waitlist_entries
  alter column reason drop not null;

-- A member's first stored registration selfie becomes permanent.
-- Unrelated profile updates remain allowed; only replacing/clearing avatar_path is blocked.
create or replace function public.prevent_registration_selfie_change()
returns trigger
language plpgsql
as $$
begin
  if old.avatar_path is not null and new.avatar_path is distinct from old.avatar_path then
    raise exception 'Registration selfie is permanent and cannot be changed.';
  end if;

  if old.profile_photo_completed_at is not null
     and new.profile_photo_completed_at is distinct from old.profile_photo_completed_at then
    raise exception 'Registration selfie completion record is permanent.';
  end if;

  return new;
end;
$$;

drop trigger if exists member_profiles_registration_selfie_permanent on public.member_profiles;
create trigger member_profiles_registration_selfie_permanent
before update on public.member_profiles
for each row execute function public.prevent_registration_selfie_change();


-- Keep the waitlist limited to prospective members. Existing overlaps are
-- cleaned once, and every new member profile automatically removes the matching
-- waitlist email when registration becomes active in We-Rise.
delete from public.waitlist_entries w
using public.member_profiles m
where m.email is not null
  and lower(w.email) = lower(m.email);

create or replace function public.remove_new_member_from_waitlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    delete from public.waitlist_entries
    where lower(email) = lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists member_profile_remove_waitlist_entry on public.member_profiles;
create trigger member_profile_remove_waitlist_entry
after insert on public.member_profiles
for each row execute function public.remove_new_member_from_waitlist();
