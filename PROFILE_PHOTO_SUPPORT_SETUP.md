# We-Rise profile photo and support setup

This update adds:

- a mandatory profile photo step for We-Rise members;
- private member photos shown only through short-lived signed links;
- a public Support tab for login, account, payment and technical problems;
- ticket references such as `SUPPORT-2026-000001`;
- optional screenshot attachments;
- direct support email delivery to `request4.support@gmail.com`;
- a database copy of every support request, even if email delivery temporarily fails.

## 1. Run the Supabase migration first

Open the We-Rise project in Supabase, go to **SQL Editor**, paste the complete contents of:

`supabase/migrations/0009_profile_photos_support.sql`

Then click **Run** and confirm that Supabase reports success.

The migration must be completed before deploying the new backend because it adds the profile-photo fields, private Storage buckets and support-ticket tables used by the API.

## 2. Configure free Brevo HTTPS email delivery

Render Free blocks outgoing SMTP ports, so We-Rise sends support notifications through Brevo's HTTPS API instead.

1. Create or sign in to a free Brevo account.
2. In Brevo, open **Settings → Senders, Domains & Dedicated IPs → Senders**.
3. Add `request4.support@gmail.com` as a sender named `We-Rise Support`.
4. Complete the verification message Brevo sends to that Gmail inbox.
5. Open **Settings → SMTP & API → API Keys**.
6. Create a new API key named `We-Rise Render` and copy it immediately.
7. In Render, open **WeRise-API → Environment** and add the following variables:

```text
SUPPORT_TO_EMAIL=request4.support@gmail.com
SUPPORT_EMAIL_ENABLED=true
SUPPORT_FROM_EMAIL=request4.support@gmail.com
SUPPORT_FROM_NAME=We-Rise Support
BREVO_API_KEY=PASTE_THE_BREVO_API_KEY_HERE
```

Delete the old `SUPPORT_SMTP_*` variables from Render because the free service cannot use them. Save the variables and redeploy the latest backend commit.

Never put the Brevo API key in GitHub, Vercel or a frontend `VITE_` variable. It belongs on Render only. The old Google App Password is no longer needed and should be revoked in the Google account.

## 3. Deploy both repositories

Push the same source to:

- `Riviera-Y6/SheRise` for Render;
- `skipperos/werise` for Vercel.

Confirm both services deployed the new commit.

## 4. Production test

Use a new test account and verify:

1. Sign up and confirm the email address.
2. Log in.
3. Confirm that We-Rise requires a profile photo before protected features open.
4. Upload a JPG, PNG or WebP photo.
5. Confirm Community and Messages show the photo while logged in.
6. Open We-Rise in a logged-out/private browser and confirm public Community posts do not reveal profile photos.
7. Open **Support** while logged out.
8. Send a test request with a screenshot.
9. Confirm a `SUPPORT-...` reference appears in We-Rise.
10. Confirm the email reaches `request4.support@gmail.com` and that replying addresses the member directly.

The live configuration endpoint should return `"email_provider":"brevo"` and `"email_delivery_ready":true`.

If Brevo delivery is not configured or temporarily fails, the request is still saved in `public.support_tickets`; the member is told that email delivery is delayed rather than being falsely told it was emailed.
