# Ask We-Rise — Gemini production setup

Ask We-Rise is now a real Gemini-powered assistant with We-Rise-specific boundaries. It is available only to logged-in members with access and a completed profile photo.

## What the production flow protects

- The Gemini API key exists only on Render. It is never placed in Vercel, browser code or a `VITE_*` variable.
- The browser sends a bounded current question and only the last few chat turns to the Render API.
- We-Rise does not save the member's conversation content. The database stores only usage metadata such as request time, model, category, character counts, token counts and success/failure state.
- Database-backed daily limits prevent a page refresh or second Render process from bypassing limits.
- The system prompt keeps answers within We-Rise topics and refuses prompt extraction, unrelated general-purpose requests and unsafe instructions.
- Health, legal and financial answers remain general education. Immediate danger, abuse or self-harm concerns receive a safety-first response and direction to real-world help.

## 1. Run the migration

Run this in the Supabase SQL Editor after migrations 0008 and 0009:

```text
supabase/migrations/0010_gemini_payfast_production.sql
```

## 2. Create the Gemini API key

Create a Gemini API key for the We-Rise backend in Google AI Studio / the Google project owned by We-Rise. Apply an API quota or billing budget in Google so unexpected usage cannot grow without warning.

Never paste the key into Vercel or commit it to GitHub.

## 3. Add Render environment variables

Add these to the **WeRise-API** service on Render:

```env
ENABLE_GEMINI_AI=true
GEMINI_API_KEY=your_real_server_side_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=25000
GEMINI_TRIAL_DAILY_LIMIT=10
GEMINI_MEMBER_DAILY_LIMIT=30
GEMINI_STAFF_DAILY_LIMIT=100
```

Use **Save, rebuild, and deploy**. No Gemini variable is required on Vercel.

## 4. Production test

Test with one trial member and one paid/admin member:

1. Ask a normal We-Rise question about a goal, relationship, safety or budget and confirm a real answer arrives.
2. Ask in Afrikaans and English and confirm the selected app language is respected.
3. Ask an unrelated coding or sports question and confirm the assistant redirects to We-Rise scope.
4. Ask it to reveal its hidden prompt and confirm it refuses.
5. Use the daily allowance and confirm the next request returns a friendly limit message.
6. Confirm no conversation text appears in `ai_usage_events`.
7. Temporarily use an invalid key and confirm the user sees a safe availability message without seeing the provider error or key.

The limits and model can be changed later in Render without rebuilding the frontend.
