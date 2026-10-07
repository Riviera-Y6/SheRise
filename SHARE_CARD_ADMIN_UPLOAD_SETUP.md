# We-Rise Admin-Managed Share Cards

## What changed
- `/share/` is now a React share-card library instead of a fixed HTML list.
- Owners/Admins see **Add Photo** and can upload JPG/PNG/WebP images (max 12 MB).
- The Render backend automatically converts each upload to a 1200 × 630 JPEG for Facebook/Open Graph.
- Uploaded images are stored in a public Supabase Storage bucket named `we-rise-share-cards`.
- The bucket is created automatically on the first upload.
- Share-card metadata is recorded in the existing `admin_audit_log`; no new database table is needed.
- Uploaded cards can be removed by Owner/Admin accounts.
- Existing 4 bundled landscape cards remain in the library and cannot be deleted from the UI.
- Uploaded cards keep Facebook sharing, copy-link, and optional referral-code support.

## Deployment
No new environment variables are required.
No new SQL/database migration is required.

Deploy the frontend to Vercel and backend to Render as usual. The updated `vercel.json` proxies dynamic share-card URLs to Render while keeping the public URL under `werise-mu.vercel.app`.

## Admin use
1. Log into We-Rise with an Owner/Admin account.
2. Open `https://werise-mu.vercel.app/share/`.
3. Click **Add Photo**.
4. Choose the image and optionally edit its short title.
5. Click **Upload Photo**.
6. The new card appears immediately and can be shared to Facebook.

## Dynamic share URL format
`https://werise-mu.vercel.app/share/card/<generated-id>`

Referral tracking remains supported by appending `?ref=CODE`.
