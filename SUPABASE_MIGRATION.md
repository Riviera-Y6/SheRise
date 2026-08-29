# Cloudflare D1 -> Supabase migration note

This package is a **stack migration of the code**, not a copy of any existing production D1 data.

If the old D1 test database contains data you care about, export it before retiring that environment. The current locally tested Phase 1/2 records were development data, so the clean Supabase project normally starts empty.

The schema in `supabase/schema.sql` includes:

- campaigns / donations
- community topics / comments / support reactions
- referrals
- member profiles
- direct conversations / messages
- indexes
- atomic donation function
- community feed aggregate function
- support toggle function
- inbox aggregate function
- RLS enabled on all application tables
