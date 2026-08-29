# We-Rise implementation state — August 2026

## Kirsten correction pass

- SheRise rebranded to **We-Rise** throughout the visible application.
- `sis / sister / sisters / suster / susters` wording replaced with **We-Rise Lady / We-Rise Ladies** or neutral trusted-contact wording.
- English/Afrikaans navigation and headings cleaned up.
- Hard-coded Community demo people removed.
- Ask We-Rise wording and health-response fallback improved.
- Safety flow no longer falsely claims an alert was automatically sent.
- PWA/install instructions and reseller wording cleaned up.

## Community Phase 1

- Mobile-first Community feed.
- Inline post composer.
- 250-character Community posts.
- Conversation/detail screen.
- Persistent comments.
- Support reactions.
- Real reply/support counts.
- Loading, empty, retry and API-error states.
- English/Afrikaans interaction copy.

## Direct Messages Phase 2

- Messages/Boodskappe tab.
- We-Rise Lady member directory.
- One-to-one persistent conversations.
- Inbox previews and unread badges.
- Sent/read ticks.
- 20-message pagination.
- Active-chat-only polling instead of loading every conversation continuously.
- Free message limit: **150 characters**.
- Premium entitlement scaffold: **2,000 characters**.
- Backend enforces the plan limit independently of the browser UI.

## Current infrastructure

The working Phase 1 and Phase 2 product has now been migrated to the stack required for deployment:

- **Vercel** — React/Vite frontend
- **Render** — Hono/Node API
- **Supabase** — PostgreSQL persistence

The old Cloudflare Worker/D1 runtime files are not part of the active build.

Supabase RLS is enabled and browser clients do not receive the service-role secret. The Render API is the application data gateway in this phase.

## Production security note

Member identity is still the Phase 2 per-device test identity. Proper Supabase Auth and server-verified user sessions should be implemented before public launch of private messaging.
