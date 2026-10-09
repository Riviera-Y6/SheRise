# We-Rise Referral & Earnings Engine — Setup

This build adds one shared referral system for **Resellers** and **RentIt / HuurDit**.

## 1. Run the new Supabase migration

Run this file in the Supabase SQL Editor **before testing referrals**:

`supabase/migrations/0016_referral_earnings_engine.sql`

It adds:

- permanent first-valid referral attribution on `member_profiles`
- unique referral codes for Reseller and HuurDit members
- referral link click counts
- verified referral conversions
- HuurDit earnings (`R1000.00` per qualifying verified HuurDit activation)
- manual admin payout tracking
- Paystack payment purpose for the `R1800.00` HuurDit activation

No existing Paystack secret, VAPID key, membership plan or user data is replaced.

## 2. No new Render environment variables are required

The engine uses the existing:

- `PAYSTACK_SECRET_KEY`
- `ENABLE_PAYSTACK`
- `FRONTEND_URL`
- Supabase service-role configuration

Do not put the Paystack secret key in Vercel.

## 3. Referral rules implemented

### First valid referral wins

A visitor enters through a URL such as:

`https://werise-mu.vercel.app/?ref=WRHXXXXXXXXX`

The code is validated by the Render API and remembered until registration. When the account is created, the valid referrer is permanently stored. A later referral link cannot overwrite it.

Direct visitors or people who register without a valid code remain `Direct / We-Rise`.

### Self-referrals

The system blocks an account from referring itself. Referral earnings are never created from link clicks or registrations alone.

### Paystack verification

A referral earning is created only after the qualifying Paystack transaction has been verified by the existing signed webhook flow.

## 4. HuurDit / RentIt logic

- Member opens HuurDit / RentIt.
- If not active, she can pay the **R1800.00 once-off activation** through Paystack.
- Her own first R1800 activation belongs **100% to We-Rise** and creates no earning for herself.
- After Paystack confirms the activation, she receives a permanent unique HuurDit referral link.
- When a new person registers through her link and later completes her own qualifying **R1800.00 Premium HuurDit licence sale**, the sale creates a **R1000.00 direct sales commission** for the referrer and **R800.00 for We-Rise**. This is a product/licence-sale commission, not a recruitment reward.
- When the referrer has a valid Paystack **ACCT_...** subaccount configured in Admin, checkout uses Paystack split settlement so the R1000/R800 allocation happens on that verified sale. If no subaccount is configured yet, the conversion is retained as **owed** for manual settlement rather than being lost.

## 5. Reseller logic

Opening the Reseller tab creates the member's own unique Reseller link automatically.

The system tracks:

- link clicks
- registrations
- verified membership-joining conversions

The Reseller system does **not** invent or hard-code a commission because the existing Reseller model uses the reseller's own profit above the baseline price.

## 6. Admin dashboard

The old Reseller admin section is replaced by **Referrals & Earnings**.

Admins can see:

- active Reseller programs
- active HuurDit programs
- referral link clicks
- attributed conversions
- R1000 earnings owed
- earnings already paid
- referral codes and member identities

For an owed HuurDit earning, click **Mark paid**, enter the EFT/payout reference, and the system records the payment date/reference and adds an admin audit entry.

No bank transfer is initiated automatically by We-Rise.

## 7. Recommended production test

1. Run migration `0016_referral_earnings_engine.sql`.
2. Deploy Render and Vercel.
3. Log in as Test Member A and open HuurDit.
4. Pay the R1800 activation through Paystack.
5. Confirm Member A receives a unique `WRH...` link.
6. Open that link in a clean/incognito browser.
7. Register Test Member B through the link.
8. Confirm Admin → Members shows Member B was referred by Member A.
9. Activate HuurDit for Member B and complete the R1800 Paystack payment.
10. Confirm Admin → Referrals & Earnings shows an R1000.00 **owed** earning for Member A.
11. Mark it paid with a test EFT reference and confirm it becomes **paid**.

For a direct test, register a separate member without any `?ref=` code. Admin should show `Direct / We-Rise`, and no referral earning should be created.

## 8. Refund safety

If a qualifying payment is later refunded by Paystack:

- an unpaid referral earning is automatically changed to `void`
- a refunded HuurDit activation suspends that member's HuurDit referral programme/link
- if an earning had already been paid by EFT, the historical paid record is never rewritten; instead Admin receives a review notification so the payout can be handled manually

This keeps the referral ledger auditable and prevents a refunded payment from remaining payable.
