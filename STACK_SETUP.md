# Phase 3 note

This build now uses Supabase Auth. For an existing production project, run `supabase/migrations/0006_supabase_auth.sql` and follow `PHASE3_AUTH_SETUP.md`. The frontend now needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in addition to `VITE_API_URL`.

# We-Rise stack: Vercel + Render + Supabase

This build keeps the working Phase 1 Community and Phase 2 private-message UI, but replaces Cloudflare Worker/D1 with the production stack requested for the project:

- **Vercel** — React/Vite frontend
- **Render** — Hono/Node API
- **Supabase** — PostgreSQL database

## Data/security boundary

The browser calls the Render API. Render calls Supabase with the server-side service-role key. The service-role key is **never** exposed to Vercel or to browser JavaScript.

Supabase RLS is enabled on the application tables and this phase deliberately creates no public table policies. Direct browser database access is therefore blocked.

> Phase 2 still uses the local per-device member identity for test accounts. Proper Supabase Auth is the next account/security phase and can replace `member_key` without redesigning Community or Messages.

## Local setup

### 1. Supabase

Create a Supabase project. Open **SQL Editor -> New query**, paste all of `supabase/schema.sql`, and run it once.

From **Project Settings -> API**, copy:

- Project URL -> `SUPABASE_URL`
- Service role secret -> `SUPABASE_SERVICE_ROLE_KEY`

Never put the service-role secret in a `VITE_` variable.

### 2. Render-style API locally

```powershell
Set-Location "$HOME\OneDrive\Desktop\We-Rise\backend"
Copy-Item .env.example .env
notepad .env
npm install
npm run dev
```

Fill `backend/.env` with the real Supabase values and keep:

```env
FRONTEND_URL=http://localhost:5173
PORT=8787
```

Test:

```text
http://localhost:8787/api/health
```

Expected result includes `"database":"supabase"`.

### 3. Frontend locally

In a second PowerShell window:

```powershell
Set-Location "$HOME\OneDrive\Desktop\We-Rise"
Set-Content .env.local "VITE_API_URL=http://localhost:8787"
npm install
npm run dev
```

Open `http://localhost:5173`.

## Deploy the API to Render

Create a new **Web Service** from the GitHub repository.

Use:

- Root Directory: `backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Environment variables:

```text
SUPABASE_URL=<Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service-role secret>
FRONTEND_URL=https://YOUR-VERCEL-DOMAIN.vercel.app
NODE_VERSION=20.18.0
```

Render will provide a URL similar to:

```text
https://we-rise-api.onrender.com
```

Test `<render-url>/api/health` before connecting Vercel.

## Deploy the frontend to Vercel

Import the same GitHub repository into Vercel.

Use:

- Framework Preset: Vite
- Root Directory: repository root
- Build Command: `npm run build`
- Output Directory: `dist`

Add this Vercel environment variable:

```text
VITE_API_URL=https://YOUR-RENDER-API.onrender.com
```

Redeploy after adding/changing `VITE_API_URL` because Vite injects it at build time.

Finally set Render `FRONTEND_URL` to the final Vercel production domain and redeploy the Render service.

## Production flow

```text
We-Rise member
      |
      v
Vercel (React/Vite)
      |
      v
Render (Hono Node API)
      |
      v
Supabase (Postgres)
```
