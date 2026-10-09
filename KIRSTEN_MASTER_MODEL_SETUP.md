# We-Rise — Kirsten Master Model Deployment Setup (October 2026)

This release supersedes older pricing/referral notes where they conflict with this file.

## Business model in this release

- Standard membership: **R194 once-off**, then **R166/month from month 2**.
- Monthly R166 allocation: **R10 BackMi + R33 VulDit/Fuel-It + R123 We-Rise operating/infrastructure**.
- HuurDit/RentIt: **R1800 once-off activation + R800/month infrastructure from month 2**.
- A genuine qualifying R1800 Premium licence sale through a member's HuurDit link creates a **R1000 direct sales commission**, with **R800 allocated to We-Rise**. No commission is created for recruitment alone.
- Failed recurring payments receive a **5-day grace period** before the applicable membership/licence access can be suspended.

## 1. Run the Supabase migration

Open the Supabase SQL Editor for the live We-Rise project and run:

`supabase/migrations/0017_kirsten_master_business_model.sql`

Run it once before relying on the new HuurDit recurring billing and VulDit ledger.

## 2. Create the Paystack R800 monthly HuurDit plan

In the same live Paystack business used by We-Rise, create a recurring plan with:

- Amount: **R800.00**
- Currency: **ZAR**
- Interval: **Monthly**

Copy its plan code (`PLN_...`).

## 3. Add the Render environment variable

Add this to the live Render backend and redeploy:

`PAYSTACK_RENTIT_PLAN_CODE=PLN_your_real_plan_code`

Keep the existing `PAYSTACK_PLAN_CODE` for the normal R166 membership plan unchanged.

## 4. Configure direct R1000 HuurDit sales commissions

For each HuurDit seller who must receive direct split settlement, create/obtain the seller's Paystack subaccount in Paystack. It will look like `ACCT_...`.

In We-Rise:

1. Open **Admin**.
2. Open **Members**.
3. Open the HuurDit member.
4. Enter the member's Paystack subaccount code in **RentIt Paystack subaccount**.
5. Save.

On a qualifying R1800 Premium sale, the checkout then sends **R1000 to that seller subaccount and R800 to the We-Rise main account**, subject to Paystack settlement/fees. If a seller has no valid subaccount code yet, We-Rise records the R1000 as owed for manual settlement instead of discarding the earning.

## 5. VulDit / Fuel-It handling

Each verified R166 recurring membership payment records the current **R33 VulDit allocation** in the internal credit ledger. A referrer's accumulated qualifying R33 credits are applied against her own R166 monthly platform cost first. Any balance above R166 is shown as excess VulDit/Brandstofbesparing credit for the applicable payout process.

The fixed R166 Paystack membership plan itself still charges according to Paystack's subscription cycle; the We-Rise ledger records the offset/effective cost and excess credit. Bank payout of excess Fuel-It credit requires an approved payout destination/process and is not silently sent to an unknown bank account.

## 6. Service Agreement

The new public **Service Agreement / Diensooreenkoms** tab contains Kirsten's current master-model terms, including the SARS wording supplied for this release, the pricing model, anti-recruitment wording, Fuel-It/VulDit rules, five-day grace policy and tax-responsibility clauses.

Legal/regulatory wording should be supported by the business's own records and professional advice where required.
