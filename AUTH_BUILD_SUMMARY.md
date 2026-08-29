# Phase 3 Auth Build Summary

- Public website remains accessible without login.
- Added Supabase email/password registration and login.
- Added email confirmation flow.
- Added forgot-password / password recovery flow.
- Added persistent browser sessions through Supabase Auth.
- Added member header state + logout.
- Added polished locked-feature screens for private/personal areas.
- BackMi and Community remain publicly browsable, but write/support/donation actions require login.
- Waitlist remains public.
- Render verifies Supabase access tokens on every protected operation.
- Authenticated member identity comes from `auth.users.id`, not a local device ID.
- Added `0006_supabase_auth.sql` migration and automatic auth-user -> member-profile trigger.
