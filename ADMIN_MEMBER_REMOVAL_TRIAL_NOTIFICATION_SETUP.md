# We-Rise Admin Member Removal + 3-Day Trial + New-Member Push

Run this migration after `0014_admin_push_notifications.sql`:

`supabase/migrations/0015_admin_remove_user_trial_notifications.sql`

It changes the free trial to 3 days, adds registration location fields to member profiles, and stores each admin browser's notification language. Existing trialing accounts are aligned to three days from their original trial start.

## Admin Remove User
Open `/admin` -> Members -> View. Normal member records now include a **Remove user** button.

Removing a user:
- blocks their Supabase Auth account from signing in;
- sets We-Rise membership access to `suspended`;
- keeps payment and audit records for accountability;
- attempts to cancel an attached Paystack subscription;
- writes an admin audit event.

Owner/admin/reviewer accounts cannot be removed from this button, and an admin cannot remove their own account.

## New-member browser notifications
Registration now collects Province/State, City/Town and Country. After the required permanent selfie is completed, registered admin devices receive a browser/PWA fly-in notification such as:

- `Sannie Smit from Pretoria, Gauteng just joined!`
- `Member #30`

An Afrikaans admin device receives the equivalent Afrikaans text. The member number is the current count of normal We-Rise member accounts.

Existing VAPID keys remain unchanged. Do not regenerate them.
