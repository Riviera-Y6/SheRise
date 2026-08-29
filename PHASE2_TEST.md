# We-Rise Phase 2 test — Supabase/Render/Vercel architecture

Before testing, complete `STACK_SETUP.md` through the local Supabase + backend + frontend setup.

## Test Community

1. Open Community.
2. Create a post.
3. Open it and add a comment.
4. Toggle Support.
5. Refresh. The post/comment/support state must persist in Supabase.

## Test private messaging with two members

1. Open `http://localhost:5173` normally and choose one test member name.
2. Open a private/incognito browser window to the same URL and choose a different test member name.
3. In browser A: Messages -> New message -> choose member B -> send.
4. In browser B: check unread badge, open the conversation and reply.
5. Refresh both browsers. The conversation must persist in Supabase.
6. Test the Free 150-character limit. Premium remains capped at 2,000 characters.
7. Send 20+ messages and verify **Load earlier messages** pagination.

If the frontend loads but data actions fail, first open `http://localhost:8787/api/health`. It must report the Supabase database as available.
