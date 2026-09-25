# We-Rise — Kirsten September Update

This build adds only the requested September changes on top of the current Paystack + We-Rise Calculator build.

## Included changes

1. Home growth goals
   - SHORT TERM GOAL / KORT TERMYN DOELWIT: 1,000+ Members / Lede
   - LONG TERM GOAL / LANG TERMYN DOELWIT: 1,000,000+ Members / Lede

2. Permanent registration selfie
   - Registration explains that a permanent selfie is required.
   - The required profile step uses the device's live front camera through `getUserMedia`.
   - There is no gallery/file-picker option in the We-Rise UI.
   - Once saved, the selfie is view-only.
   - Render rejects any normal attempt to upload a second selfie.
   - Supabase has a database trigger that prevents the stored selfie path/completion record from being changed or cleared.

3. Waitlist update
   - Adds the R199.00 registration-fee explanation in Afrikaans and English.
   - Adds Province / State and City / Town.
   - Removes Reason for Request from new submissions.
   - A matching waitlist entry is automatically removed when that email becomes a registered We-Rise member.

## Required Supabase step BEFORE deployment

Run this file in Supabase SQL Editor:

`supabase/migrations/0012_registration_selfie_waitlist_goals.sql`

Then deploy the same source to the existing Render and Vercel repositories.

## Recommended test

1. Open Home in English and Afrikaans and confirm both goal blocks.
2. Add a test email to the waitlist with Province/State, City/Town and Country.
3. Register with exactly the same email.
4. Confirm the required selfie screen opens and there is no gallery option.
5. Allow camera permission, capture a selfie, retake it before saving if desired, then save it.
6. Reopen the member avatar and confirm the selfie is view-only.
7. Confirm the matching waitlist row has been removed.
