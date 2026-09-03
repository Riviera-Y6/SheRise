# We-Rise & BackMi PayFast setup

This release contains the payment and verification foundation, but live payments must remain disabled until the Supabase migration, PayFast merchant configuration and sandbox tests are complete.

## What is implemented

- Every new authenticated member receives a 7-day free trial.
- After the trial, protected functionality requires We-Rise membership.
- The membership checkout charges a configurable once-off joining amount and creates a configurable monthly PayFast subscription.
- The default model is R194 once-off, followed after 30 days by R166 per month. The displayed USD references are $12 and $10.
- Every verified monthly payment creates a configurable R33 BackMi foundation allocation in the internal ledger. The default USD reference is $2.
- BackMi has no separate monthly subscription.
- Help requests remain private until a BackMi reviewer approves them.
- Each request receives a database-generated code such as `BACKMI-2026-000001`.
- Supporting PDF/JPG/PNG documents are kept in a private Supabase Storage bucket and exposed only through short-lived signed links to the request owner or a reviewer.
- Approved requests can accept voluntary gifts through a separate PayFast checkout once that feature is explicitly enabled.
- Return URLs never mark a payment successful. Only a valid PayFast ITN, signature check, PayFast server confirmation and amount match can finalise it.
- Unique PayFast transaction IDs and ledger event keys prevent duplicate processing.
- The internal ledger traces verified membership revenue, BackMi allocations, gifts and reported PayFast fees.
- Final BackMi payouts are deliberately not implemented. No founder/member/split payout percentage is hard-coded.

## 1. Run the Supabase SQL

Run these migrations in order in Supabase SQL Editor:

1. `supabase/migrations/0007_wealth.sql` — if it has not already returned Success.
2. `supabase/migrations/0008_payfast_backmi.sql`.

Migration 0008 resets old prototype BackMi totals to zero because those pledges were not verified PayFast payments. The legacy rows remain in the old donations table for audit purposes, but they no longer count as received money.

## 2. Configure reviewer and admin access on Render

Add the real account email addresses as comma-separated values:

```env
WE_RISE_ADMIN_EMAILS=owner@example.com
BACKMI_REVIEWER_EMAILS=reviewer1@example.com,reviewer2@example.com
```

Admin and reviewer accounts are omitted from the ordinary member directory. Admin access does not expose journals, private messages, Welvaart records or safety contacts.

## 3. Configure PayFast sandbox on Render

```env
PAYFAST_MODE=sandbox
ENABLE_PAYFAST=true
PAYFAST_MERCHANT_ID=your_sandbox_merchant_id
PAYFAST_MERCHANT_KEY=your_sandbox_merchant_key
PAYFAST_PASSPHRASE=your_exact_sandbox_passphrase
API_PUBLIC_URL=https://werise-api.onrender.com
FRONTEND_URL=https://werise-mu.vercel.app
```

The notification endpoint is:

```text
https://werise-api.onrender.com/api/payfast/itn
```

It must be publicly reachable over HTTPS. Do not add PayFast secrets or the Supabase service-role key to Vercel or any `VITE_*` variable.

Leave this off initially:

```env
ENABLE_BACKMI_PAYMENTS=false
```

The database also contains a `backmi_gifts_enabled` switch. Both the Render switch and database switch must be true before voluntary-gift checkouts can open. This deliberate double gate prevents the feature being made live by accident.

## 4. Business values are configurable

An admin can change trial days, ZAR prices, USD reference amounts, the first recurring delay, gift limits and the BackMi allocation from the Membership screen. These values live in `payment_settings`; changing them does not require rebuilding the app.

PayFast checkouts are charged in ZAR. The USD values are reference labels, not an automatic foreign-exchange feed. When the desired dollar-equivalent changes, update the ZAR values before creating new checkouts. Existing verified transactions are never rewritten.

The BackMi allocation can be a fixed amount or a percentage and can be based on the PayFast gross or net amount. The initial approved configuration is fixed R33 from the gross monthly amount. This is an internal accounting allocation; it is not a PayFast split payment.

## 5. Required sandbox test

Use a brand-new test member and verify this full sequence:

1. Register and confirm email.
2. Confirm Membership shows 7 trial days and no payment is requested.
3. Temporarily shorten the trial in admin settings or set the test profile's trial end to the past.
4. Confirm protected pages show the membership screen.
5. Start the membership checkout and complete a PayFast sandbox payment.
6. Confirm returning to We-Rise only says confirmation is pending.
7. Confirm the verified ITN changes the member to Active and appears in Payment History.
8. Trigger a recurring sandbox payment and confirm a BackMi foundation ledger entry is created once only.
9. Resend the same ITN and confirm totals do not increase a second time.
10. Submit a BackMi request with evidence and confirm it is invisible publicly.
11. Log in as a reviewer, open the evidence and approve the request with a maturity date.
12. Confirm it now appears publicly with its unique request code.
13. Only after PayFast/compliance approval, enable both BackMi gift switches and test a voluntary gift.
14. Confirm the public total changes only after a verified ITN and that the gift is linked to the correct request and transaction.

## 6. Before enabling live mode

Obtain written confirmation from PayFast that the proposed model is acceptable, especially collecting voluntary gifts intended for approved third-party members and holding funds until maturity/payout. A separate BackMi bank account may help with accounting separation, but the account name alone does not determine legal or PayFast compliance.

Also obtain suitable South African legal/accounting guidance on the entity receiving the funds, consumer terms, refunds, recurring-payment consent, privacy of evidence documents, tax treatment, anti-fraud controls and the final payout process.

After approval, replace the sandbox merchant details with the live merchant details, test a small real transaction, and only then set:

```env
PAYFAST_MODE=live
ENABLE_PAYFAST=true
```

Do not enable `ENABLE_BACKMI_PAYMENTS` until the third-party gift and payout model has been approved. The software intentionally cannot execute a final BackMi payout in this release.
