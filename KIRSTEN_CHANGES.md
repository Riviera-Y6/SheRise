# Kirsten Correction Pass — 17 August 2026

Implemented from Kirsten's screenshot/WhatsApp notes.

## Public rebrand
- SheRise → We-Rise across the visible application, page title, favicon, PWA manifest, AI identity, reseller copy, footer, and backend health response.
- Header/AI icon changed from **S** to **W**.
- `sis`, `sister`, `sisters`, `suster`, `susters`, `Sisterhood`, and `Susterkap` removed from visible app copy and replaced with **We-Rise Lady / We-Rise Ladies** or neutral trusted-contact wording where that is more accurate.

## Language cleanup
- English now shows **Vision**, **Wellness**, and **Safety**.
- Afrikaans retains **Visie**, **Welstand**, and **Veiligheid**.
- Reseller, install, safety, community, and footer copy cleaned up in both languages.

## Community
- Removed the four hard-coded demo profiles/topics.
- Community now loads topics from `GET /api/topics` and posts through `POST /api/topics`.
- Added loading, empty, error, and retry states.

## BackMi
- Campaigns now load from D1 through the Hono API.
- Campaign creation and donations persist through the API.
- Donation lists and daily totals are normalized from D1 data.
- Home campaign and raised totals now come from real campaign data instead of hard-coded demo numbers.

## Ask We-Rise
- Personalized greeting uses the saved member name.
- Replaced the generic "Hello beautiful" style response.
- Added a useful health-symptom fallback for the exact itching-foot scenario shown in the screenshots, with clear limits on diagnosis.
- AI avatar changed to **W**.
- This is still a local rules-based assistant until a real AI provider is connected.

## Safety
- Updated South African emergency entries and removed the mixed international list for this pass.
- Panic button now opens an emergency SMS draft to the first trusted contact instead of falsely claiming it sent an alert automatically.
- Added an explicit limitation notice.
- Daily check-in persists for the day on the device.
- Trusted contacts migrate from the old local-storage key to the new We-Rise key.

## Reseller
- "Share with Sisters" → "Share with We-Rise Ladies".
- SheRise references changed to We-Rise throughout the flow.
- Referral URL derives from the deployed site origin instead of a hard-coded placeholder domain.
- 80/20 explanation simplified to reseller/platform share.

## Install / PWA
- Rewrote iPhone and Android home-screen instructions.
- Added a We-Rise web manifest and production service-worker registration.

## Developer cleanup
- Added `.gitignore` and `.env.example`.
- Vite `/api` proxy corrected to Wrangler on `127.0.0.1:8787`.
- Added safe D1 terminology migration.
- Removed bundled `node_modules`, local Wrangler state, Multos metadata, and `.env.local` from the clean handoff ZIP.

## Community Phase 1 — 19 August 2026

The Community has now been rebuilt as a mobile-first social support feed rather than a simple topic list.

Implemented:

- Premium We-Rise Community feed UI.
- Inline post composer (no popup required).
- 250-character limit with live counter for community posts.
- Dedicated conversation/detail screen for each post.
- Persistent comments/advice in Cloudflare D1.
- 250-character limit with live counter for comments.
- Support/heart reactions stored in D1.
- A per-device supporter key prevents repeated support taps from inflating the count before proper authentication is added.
- Real reply and support counts on every post.
- Compact emergency-support strip kept visible without dominating the social feed.
- English/Afrikaans interaction copy throughout the new Community experience.
- Loading, empty, API-error and retry states.
- Keyboard shortcut on desktop: Ctrl/Command + Enter posts or sends a comment.
- New D1 migration: `backend/migrations/0003_community_phase1.sql`.

Important production note: member identity is still based on the locally saved display name/device key. Proper account authentication remains the next step before treating identity or reactions as fully secure user records.

## Direct Messages Phase 2 — 19 August 2026

Phase 2 adds the member-to-member communication layer Kirsten requested while keeping data usage controlled.

Implemented:

- New **Messages / Boodskappe** navigation tab.
- Premium mobile-first inbox and direct-conversation UI matching the We-Rise visual system.
- Real We-Rise Lady directory backed by D1 member profiles; no fake member seed data.
- One-to-one D1 conversations and persistent direct messages.
- Inbox previews, timestamps, unread badges, and read-state ticks.
- Messages load 20 at a time rather than loading full histories.
- Only an actively open conversation polls for new messages (5-second interval); the rest of the app does not poll chat history.
- Free direct-message allowance: **150 characters**.
- Premium entitlement scaffold: **2,000 characters**.
- Over-limit Free drafts stay in the composer instead of being deleted, with a clear Premium nudge.
- Server-side plan validation prevents a Free browser from bypassing the 150-character rule simply by editing the UI.
- D1 hard ceiling of 2,000 characters protects the stored message row.
- New additive migration: `backend/migrations/0004_private_messages_phase2.sql`.
- New tables: `member_profiles`, `private_conversations`, `private_messages`.

Cost-control choices carried into the implementation:

- text-only direct messages in Phase 2;
- 20-message pagination;
- no global realtime connection;
- polling only while the chat is open;
- no media blobs stored in D1.

Production security note: Phase 2 still uses the pre-auth per-device member key for local/staging testing. True private messaging must not be publicly launched until proper authenticated accounts and server-verified authorization are added.
