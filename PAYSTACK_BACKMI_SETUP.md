# We-Rise Paystack test setup

This release switches the We-Rise payment provider from PayFast to Paystack without changing the existing membership, trial, pricing, BackMi, payment-history, grace-period or internal-ledger model.

## What the Paystack flow does

- New members still receive the existing free trial.
- After the trial, the existing Membership screen starts a hosted Paystack checkout.
- The once-off joining payment remains controlled by the existing We-Rise `joining_fee_zar` setting (default R194).
- The recurring membership remains controlled by the existing `monthly_fee_zar` setting (default R166/month).
- The first successful membership checkout is CARD ONLY so Paystack can return a reusable card authorization.
- After the joining payment is securely verified, the Render backend creates the recurring Paystack subscription against one Paystack monthly plan.
- The subscription first-debit date is scheduled using the existing `first_recurring_delay_days` setting (default 30 days).
- The Paystack secret key never goes to Vercel or browser code.
- A return to the website never activates membership by itself. The backend verifies Paystack webhook signatures and verifies successful transactions with Paystack before recording them.
- The existing card-update and cancellation controls use Paystack's hosted subscription management and subscription-disable APIs.
- BackMi gift checkout remains separately gated and disabled unless both existing BackMi switches are enabled.

## 1. Run the new Supabase migration

The previous migrations remain part of the deployed database history. Do not delete or rename them.

After the existing migrations through `0010_gemini_payfast_production.sql`, run:

```text
supabase/migrations/0011_paystack_payments.sql
```

Migration 0011 preserves the existing financial tables and historical records, adds the Paystack customer/card management fields, allows Paystack webhook audit records, and adds Paystack fee labels to the existing ledger model.

## 2. Create one Paystack TEST monthly plan

In the Paystack dashboard while using TEST keys, create one plan:

```text
Name: We-Rise Monthly Membership
Currency: ZAR
Amount: R166.00
Interval: Monthly
```

Paystack will give you a plan code similar to:

```text
PLN_xxxxxxxxxxxxx
```

Do not create a subscription manually for each member. We-Rise creates each member's subscription automatically after their first verified card payment.

Important: We-Rise checks the plan amount, currency and monthly interval before opening membership checkout. If the Paystack plan is not the same amount as the current We-Rise `monthly_fee_zar` admin setting, checkout is blocked with a clear plan-mismatch error.

## 3. Add these Render environment variables

On the Render service for `we-rise-api` add:

```env
ENABLE_PAYSTACK=true
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxx
PAYSTACK_PLAN_CODE=PLN_xxxxxxxxxxxxxxxxx
PAYSTACK_CURRENCY=ZAR
FRONTEND_URL=https://werise-mu.vercel.app
API_PUBLIC_URL=https://werise-api.onrender.com
ENABLE_BACKMI_PAYMENTS=false
```

Do not put `PAYSTACK_SECRET_KEY` into Vercel and do not create a `VITE_PAYSTACK_SECRET_KEY` variable.

A Paystack public key is not required by this implementation because transactions are initialized securely on Render and the browser is redirected to Paystack's hosted checkout.

## 4. Configure the Paystack webhook

In Paystack Dashboard -> API Keys & Webhooks, set the webhook URL to:

```text
https://werise-api.onrender.com/api/paystack/webhook
```

The endpoint verifies Paystack's `x-paystack-signature` HMAC-SHA512 signature using the Render-only secret key before processing the event.

## 5. Required sandbox test

Use a brand-new test member and verify this sequence:

1. Register and confirm the account.
2. Complete the existing profile-photo requirement.
3. Let the free trial expire, or temporarily move the test profile's trial end into the past.
4. Open Membership and confirm the existing prices are unchanged.
5. Accept the recurring-payment terms and choose Continue to Paystack.
6. Complete the Paystack TEST card payment.
7. Return to We-Rise and confirm the site says secure confirmation is pending.
8. Confirm the Paystack webhook activates the membership and the payment appears in Payment History.
9. Confirm the member profile has a Paystack subscription and a next billing date.
10. Confirm Update card opens Paystack's hosted subscription-management page.
11. Test Cancel monthly membership and confirm future Paystack billing is disabled while already-paid access remains available through the recorded paid-through date.
12. Test a recurring invoice/charge in Paystack and confirm the existing We-Rise payment history and BackMi allocation ledger update only once.

## 6. BackMi gifts

BackMi gift checkout has also been changed to initialize Paystack transactions, but it remains OFF by default:

```env
ENABLE_BACKMI_PAYMENTS=false
```

The database `backmi_gifts_enabled` switch must also be true before BackMi gifts can open. Leave both disabled until the business/compliance model for third-party gifts and payouts has been approved.

## 7. Going live later

After the full TEST flow is confirmed, replace only the Paystack test secret/plan with the LIVE Paystack secret and a matching LIVE monthly ZAR plan. Keep the same backend-only architecture and webhook endpoint.
