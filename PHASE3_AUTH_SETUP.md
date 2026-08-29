# We-Rise Phase 3 — Login / Registration Setup

This build keeps the website publicly viewable while requiring a real Supabase Auth account for personal or write actions.

## Public without login

Visitors can open We-Rise, browse Home, view BackMi campaigns, read Community conversations, and join the Waitlist.

## Login required

Login is required for the AI assistant, Journal, Vision Board, Wellness, Safety/Emergency Network, private Messages, Resell tools, creating a BackMi request, donating, creating/commenting/supporting Community posts, and all account-specific data.

## 1. Run the Supabase migration

In Supabase -> SQL Editor, run:

`supabase/migrations/0006_supabase_auth.sql`

This links `member_profiles` to `auth.users`, adds ownership fields, creates the automatic profile trigger, and adds the authenticated donation function.

## 2. Supabase Authentication settings

In Supabase -> Authentication:

- Make sure Email authentication is enabled.
- Keep email confirmation enabled for production.
- Set the Site URL to the live Vercel production URL.
- Add the live Vercel URL to Redirect URLs.
- For local testing, also add `http://localhost:5173` to Redirect URLs.

## 3. Vercel environment variables

Add these to the We-Rise Vercel project:

- `VITE_API_URL` = the live Render API URL
- `VITE_SUPABASE_URL` = the Supabase Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = the Supabase publishable key (`sb_publishable_...`)

The publishable key is intended for browser use. Never add the Supabase secret/service-role key to Vercel frontend variables.

Redeploy Vercel after adding/changing Vite environment variables.

## 4. Render environment variables

Keep the existing server-side values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (the server-only Supabase secret key)
- `FRONTEND_URL` = live Vercel URL

No Supabase secret is sent to the browser.

## 5. Test flow

1. Open the live website in a signed-out/incognito window. It must load normally.
2. Browse Home, BackMi, Community and Waitlist without logging in.
3. Open Messages/Safety/Journal/etc. A member lock screen should appear.
4. Click Log in -> Create account.
5. Register with full name, email and password.
6. Confirm the email from the Supabase email.
7. Return to We-Rise and log in.
8. Confirm the header shows the member name.
9. Test Community post/comment/support.
10. Test private Messages with a second authenticated account.
11. Test emergency contacts.
12. Log out and confirm protected features lock again while the public website remains accessible.

## Security model

The frontend uses only the Supabase publishable key for Auth. Every protected Render endpoint verifies the bearer access token with Supabase and derives the member identity from the verified Auth user ID. The API no longer trusts a browser-supplied `member_key` for protected operations.
