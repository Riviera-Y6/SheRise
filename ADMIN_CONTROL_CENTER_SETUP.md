# We-Rise Admin Control Centre V1

This build adds a protected `/admin` control centre without changing the normal member experience.

## What is included

- `OWNER` and `ADMIN` server-side roles.
- Owner/Admin accounts receive permanent We-Rise feature access without a paid membership.
- Protected `/admin` route; normal members receive a backend 403 response from admin APIs.
- Overview metrics: registered members, new members today, active/trial/past-due/cancelled membership counts, waitlist, current-month revenue, estimated MRR and failed payments.
- Members: search/filter, permanent registration selfie, membership/subscription status, Paystack customer/subscription references, account dates and recent payment history.
- Live activity: joins, payments and waitlist joins.
- Payments: Paystack transaction history and filters.
- Waitlist: location details, CSV export and audited removal.
- Community moderation: recent posts/comments and audited deletion.
- BackMi: review queue + ledger visibility.
- Resellers: referral records and recorded commission totals.
- Audit log for sensitive admin actions.
- Read-only System screen with safe production status; secret API keys are never returned to the browser.

## 1. Run the Supabase migration

Open Supabase SQL Editor and run:

`supabase/migrations/0013_admin_control_center.sql`

Run this after migration `0012_registration_selfie_waitlist_goals.sql`.

## 2. Configure the two owners in Render

In **Render -> We-Rise API -> Environment**, add:

```env
WE_RISE_OWNER_EMAILS=FIRST_OWNER_EMAIL,SECOND_OWNER_EMAIL
```

Use the exact email addresses used by the two Supabase / We-Rise login accounts. Separate multiple emails with commas.

Example only:

```env
WE_RISE_OWNER_EMAILS=owner1@example.com,owner2@example.com
```

Do not put passwords in this value.

`WE_RISE_ADMIN_EMAILS` remains available for future staff who should have Admin rather than Owner status:

```env
WE_RISE_ADMIN_EMAILS=staff@example.com
```

The same email should not normally be in both variables. Owner wins if it is.

After changing Render environment values, save and redeploy the API.

## 3. Owner accounts

Each owner should have a normal confirmed We-Rise account using the exact email placed in `WE_RISE_OWNER_EMAILS`.

When the owner next logs in or refreshes their profile, the Render backend assigns the `owner` role. Owner/Admin access is evaluated server-side.

Owners/Admins:

- do not need to pay Paystack to use We-Rise member features;
- are not marked as fake paid members;
- can open `/admin`;
- do not receive the normal membership lock;
- can view the admin data through protected Render API endpoints.

This does not alter Paystack transaction accounting.

## 4. Open Admin

Production URL:

`https://werise-mu.vercel.app/admin`

Once an owner/admin is logged into the normal site, an **Admin** shortcut also appears next to the account chip in the header.

## Security notes

- Supabase `SERVICE_ROLE_KEY`, Paystack secret keys and Gemini keys remain on Render only.
- The browser never receives the Supabase service-role key.
- Admin endpoints require a valid Supabase bearer session and an `owner` or `admin` role.
- Member selfies are returned as short-lived signed URLs, not public bucket URLs.
- No card number/CVV data is stored or displayed by We-Rise; Paystack remains responsible for card handling.
- Admin audit records are stored in `public.admin_audit_log` and have RLS enabled with no browser policies.

## Suggested first test

1. Run migration `0013`.
2. Add both owner emails to `WE_RISE_OWNER_EMAILS` on Render.
3. Redeploy Render and Vercel.
4. Log in as an owner.
5. Confirm normal We-Rise features open without requiring payment.
6. Open `/admin` and confirm the dashboard loads.
7. Log in using a normal member account and manually visit `/admin`; it should show that Admin access is required, and direct calls to `/api/admin/...` should return HTTP 403.
