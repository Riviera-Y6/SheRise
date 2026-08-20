# We-Rise Phase 2 Local Test

## Fresh extracted copy

Backend PowerShell:

```powershell
Set-Location "$HOME\OneDrive\Desktop\We-Rise-Phase2-Test\We-Rise\backend"
npm install
npx wrangler d1 execute sherise-local --local --file=.\schema.sql
npx wrangler dev --local
```

Frontend PowerShell:

```powershell
Set-Location "$HOME\OneDrive\Desktop\We-Rise-Phase2-Test\We-Rise"
Set-Content -Path ".env.local" -Value "VITE_API_URL=http://127.0.0.1:8787"
npm install
npm run dev
```

Open `http://localhost:5173`.

## Test two We-Rise Ladies

1. Normal browser: enter one member name.
2. Incognito/InPrivate or a second browser: open the same local URL and enter another member name.
3. Open **Messages** in both.
4. Click **New message** and choose the other member.
5. Send a message and confirm it appears in the other inbox.
6. Open the receiving conversation and confirm the unread badge clears.
7. Send more than 150 characters as a Free member: the draft must remain visible, sending must be blocked, and the Premium explanation must appear.
8. Send at least 25 short messages, then reopen the conversation and use **Load earlier messages** to test 20-message pagination.

## Existing Phase 1 database

If you are upgrading the exact same local project folder and want to keep its Phase 1 D1 data, run this once instead of recreating the schema:

```powershell
npx wrangler d1 execute sherise-local --local --file=.\migrations\0004_private_messages_phase2.sql
```
