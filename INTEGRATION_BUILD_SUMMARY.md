# We-Rise What-Now Integration Build Summary

## Preserved

- We-Rise visual identity
- Community Phase 1
- Private Messages Phase 2
- Vercel frontend architecture
- Render Hono/Node API
- Supabase Postgres database
- English/Afrikaans UI

## Added / upgraded

### BackMi
- richer request form
- reason and category
- full explanation
- country and optional age
- real deadline field
- progress percentage
- raised vs goal
- explicit amount still needed
- donor count
- expandable donor list
- today's donation total
- Supabase persistence through existing Render API

### Safety
- maximum five emergency contacts
- emergency-contact relationship field
- contacts stored in Supabase instead of localStorage
- current browser geolocation capture
- manual location fallback
- alert log in Supabase
- per-recipient alert log
- explicit delivery status
- optional Twilio support behind a disabled-by-default security gate
- manual SMS fallback buttons when automatic SMS is not configured
- no fake "5 contacts notified" success state

### Waitlist
- full name
- email
- age
- country
- reason
- explanation
- duplicate email protection
- live waitlist count
- Supabase persistence via Render API

## Database migration

Run:

`supabase/migrations/0005_what_now_integration.sql`

on the existing We-Rise production Supabase project.

## Important pre-auth limitation

This build still uses the Phase 2 per-device member key. Keep `ENABLE_EMERGENCY_SMS=false` until Supabase Auth and Render JWT verification are implemented.
