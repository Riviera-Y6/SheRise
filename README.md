# We-Rise

We-Rise is a women-focused empowerment and support platform with Community, direct member messaging, wellness, journaling, safety, BackMi, a five-contact emergency network, a public waitlist, referrals and bilingual English/Afrikaans UI.

## Production stack

- Frontend: React 18 + Vite -> **Vercel**
- API: Hono + Node.js -> **Render**
- Database + Auth: PostgreSQL + Supabase Auth -> **Supabase**

## Phase 3 access model

The website remains public. A visitor can open We-Rise without an account and browse the public experience.

Public/read-only areas include Home, BackMi campaign browsing, Community reading and the Waitlist. Account-specific and write actions require a verified login. This includes AI, Journal, Vision Board, Wellness, Safety, private Messages, Resell tools, creating/donating to BackMi requests, and posting/commenting/supporting in Community.

## Supabase Auth

Phase 3 replaces the temporary device identity with the verified Supabase Auth user ID. Render validates the access token for protected API routes and derives the member identity server-side.

Read [`PHASE3_AUTH_SETUP.md`](./PHASE3_AUTH_SETUP.md) before deployment.

For an existing production database, run:

`supabase/migrations/0006_supabase_auth.sql`

## Frontend environment variables

Copy `.env.example` to `.env.local` for local development and configure:

- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Only the publishable Supabase key belongs in the browser.

## Backend environment variables

Configure `backend/.env` locally or Render Environment Variables using `backend/.env.example`.

`SUPABASE_SERVICE_ROLE_KEY` / the Supabase server secret belongs only on Render and must never be exposed as a `VITE_*` variable.

## Existing feature migrations

The What-Now integration remains in `supabase/migrations/0005_what_now_integration.sql`.
