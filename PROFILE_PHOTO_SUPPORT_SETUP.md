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

## 2. Configure Gmail delivery on Render

The support address needs a Google App Password. Do not use the normal Gmail password.

1. Sign in to the Google account for `request4.support@gmail.com`.
2. Turn on **2-Step Verification** for that Google account.
3. Open the Google Account **App passwords** page.
4. Create a new app password named `We-Rise Render`.
5. Copy the 16-character password.
6. In Render, open **WeRise-API → Environment** and add the following variables:

```text
SUPPORT_TO_EMAIL=request4.support@gmail.com
SUPPORT_EMAIL_ENABLED=true
SUPPORT_SMTP_HOST=smtp.gmail.com
SUPPORT_SMTP_PORT=465
SUPPORT_SMTP_SECURE=true
SUPPORT_SMTP_USER=request4.support@gmail.com
SUPPORT_SMTP_APP_PASSWORD=PASTE_THE_GOOGLE_APP_PASSWORD_HERE
SUPPORT_FROM_NAME=We-Rise Support
```

Save the variables and redeploy the latest backend commit on Render.

Never put the App Password in GitHub, Vercel or a frontend `VITE_` variable. It belongs on Render only.

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

If Gmail delivery is not configured or temporarily fails, the request is still saved in `public.support_tickets`; the member is told that email delivery is delayed rather than being falsely told it was emailed.
