# We-Rise Admin Push Notifications Setup

This update adds persistent admin notifications, unread counts and real browser/PWA push notifications for new member registrations.

## 1. Run the Supabase migration

Run:

`supabase/migrations/0014_admin_push_notifications.sql`

in the Supabase SQL Editor after the existing admin migration.

## 2. Generate one permanent VAPID key pair

From the project folder in PowerShell:

```powershell
cd backend
npm run generate-vapid
```

Copy the three values it prints. Generate these keys **once** and keep the same pair permanently. Do not regenerate them on every deploy or existing browser subscriptions will stop working.

## 3. Add the keys to Render

Add these environment variables to the We-Rise Render API:

```text
VAPID_PUBLIC_KEY=<generated public key>
VAPID_PRIVATE_KEY=<generated private key>
VAPID_SUBJECT=mailto:request4.support@gmail.com
```

`VAPID_PRIVATE_KEY` is a server secret. Never put it in Vercel, the browser, GitHub or screenshots.

Render uses `npm install`, so the new `web-push` dependency will be installed automatically during deployment.

## 4. Deploy Render and Vercel

Deploy the same updated project to both existing repositories as normal.

## 5. Enable push on each admin device

1. Log in using an OWNER or ADMIN account.
2. Open `/admin`.
3. Click the bell in the top bar.
4. Click **Enable push notifications**.
5. Allow notifications when the browser asks.

Repeat this on every phone/PC where Jakobus or Kirsten wants notifications.

On iPhone/iPad, web push requires the We-Rise PWA to be added to the Home Screen first. Open the installed We-Rise app, then enable notifications from Admin.

## What triggers the alert?

The first notification type is `new_member`. It is created only after a normal member successfully saves the required permanent live-camera registration selfie. This means half-finished Auth signups do not trigger admin alerts.

The protected Admin bell keeps a persistent history even if push delivery is unavailable. Push notifications contain only a short registration message; full member details remain inside the protected Admin Control Centre.
