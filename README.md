# We-Rise

We-Rise is the independent React/Vite + Cloudflare Worker/D1 build recovered from the original Multos project and continued as a production-focused codebase.

## Stack

- Frontend: React 18 + Vite
- API: Hono on Cloudflare Workers
- Database: Cloudflare D1
- PWA: manifest + service worker

## Community Phase 1

The Community is a persistent social support feed with:

- 250-character posts
- 250-character comments/advice
- support reactions
- post detail/conversation view
- live reply/support counts
- Cloudflare D1 persistence
- English/Afrikaans UI copy

## Direct Messages Phase 2

Phase 2 adds a mobile-first direct member messaging experience:

- dedicated Messages tab and inbox
- We-Rise Lady directory sourced from real member profiles
- one-to-one conversations stored in D1
- polished mobile chat bubbles
- unread counts and read state
- 20-message pagination
- active-conversation polling only (5 seconds)
- Free plan: 150 characters per direct message
- Premium entitlement: up to 2,000 characters per direct message
- UI keeps over-limit draft text intact and shows an upgrade prompt
- backend enforces the member's plan limit independently of the frontend

Premium billing is **not** connected yet. New member profiles default to `free`, and there is intentionally no public endpoint that lets a browser promote itself to Premium.

## Local development

### Backend — fresh local database

```powershell
Set-Location "$HOME\OneDrive\Desktop\We-Rise\backend"
npm install
npx wrangler d1 execute sherise-local --local --file=.\schema.sql
npx wrangler dev --local
```

The local Worker normally runs at `http://127.0.0.1:8787`.

### Backend — upgrading an existing Phase 1 local database

If the Phase 1 database already exists in the same project folder, run the Phase 2 migration once:

```powershell
Set-Location "$HOME\OneDrive\Desktop\We-Rise\backend"
npm install
npx wrangler d1 execute sherise-local --local --file=.\migrations\0004_private_messages_phase2.sql
npx wrangler dev --local
```

### Frontend

Create `.env.local` in the project root:

```env
VITE_API_URL=http://127.0.0.1:8787
```

Then:

```powershell
Set-Location "$HOME\OneDrive\Desktop\We-Rise"
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`).

## Phase 2 API

Member directory:

- `POST /api/members/upsert`
- `GET /api/members?member_key=...`

Direct conversations:

- `POST /api/conversations`
- `GET /api/inbox?member_key=...`
- `GET /api/conversations/:id/messages?member_key=...&limit=20&before_id=...`
- `POST /api/conversations/:id/messages`
- `POST /api/conversations/:id/read`

## Testing two members locally

Direct messaging needs two distinct device identities. The easiest local test is:

1. Open `http://localhost:5173` in your normal browser and use one member name.
2. Open the same URL in an Incognito/InPrivate window or another browser and use a different member name.
3. Refresh/open **Messages** in both windows.
4. Use **New message** to find the other We-Rise Lady.
5. Send messages between the two windows and verify unread/read state.

Each browser profile receives its own locally generated `werise_member_key`, while both connect to the same local D1 database.

## Important production security note

Phase 2 deliberately builds the messaging product and persistence layer **before** full authentication. Identity currently uses a locally stored per-device member key, not a verified login/session. That is suitable for local/staging UX testing, but it is **not sufficient security for a public private-messaging launch**.

Before production messaging goes live, We-Rise still needs proper registration/login, server-verified sessions, authorization bound to authenticated user IDs, blocking/reporting/moderation controls, abuse/rate limiting, and the real Premium billing entitlement flow.
