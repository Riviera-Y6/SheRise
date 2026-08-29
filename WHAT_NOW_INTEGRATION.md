# We-Rise — What-Now Integration

This build keeps the existing We-Rise Community + Messages stack and integrates the three What-Now concepts Kirsten selected:

1. BackMi request cards with progress, amount still needed, deadline and donor expansion.
2. A five-person trusted emergency network with optional location capture.
3. A Supabase-backed waitlist.

## Existing production architecture remains unchanged

- Vercel: React/Vite frontend
- Render: Hono/Node API
- Supabase: PostgreSQL

The old What-Now Cloudflare/D1 backend is **not** used.

## Upgrade an existing Supabase project

Open Supabase -> SQL Editor and run:

`supabase/migrations/0005_what_now_integration.sql`

Do not rerun the entire original schema on a live database just for this upgrade.

## Backend changes

New API routes:

- `GET /api/waitlist/count`
- `POST /api/waitlist`
- `GET /api/emergency-contacts?member_key=...`
- `POST /api/emergency-contacts`
- `DELETE /api/emergency-contacts/:id`
- `POST /api/emergency-alerts`

Existing `/api/campaigns` now stores BackMi reason/category/explanation/country/age/deadline data.

## Emergency SMS safety

The alert flow never pretends a message was delivered.

By default:

`ENABLE_EMERGENCY_SMS=false`

With that setting the server logs the alert and the browser displays ready-to-send SMS buttons for each saved contact.

Optional Twilio environment variables are included in `backend/.env.example`, but **do not set `ENABLE_EMERGENCY_SMS=true` before proper Supabase Auth/JWT verification is implemented.** The current Phase 2 identity is still a per-device test key and should not be treated as sufficient authorization for a safety-critical messaging system.

## Production deploy after testing

1. Run migration `0005_what_now_integration.sql` in Supabase.
2. Push this source to GitHub.
3. Render auto-deploys the backend.
4. Vercel auto-deploys the frontend.
5. Keep `ENABLE_EMERGENCY_SMS=false` for this pre-auth test phase.
6. Test Waitlist, BackMi, emergency contact persistence, geolocation fallback and manual SMS buttons on the Vercel site.

## Phase 3 remains required

Before real member launch:

- Supabase Auth registration/login
- JWT verification on Render
- replace per-device `member_key` authorization
- bind posts/messages/emergency contacts/campaigns to authenticated user UUIDs
- only then consider enabling automatic emergency SMS delivery
