# Lovable prompt — investigate and fix Supabase auth failure (online only)

You are Lovable, the repo-aware debugging assistant. The app is at `Pro/retail-manager/frontend`. A recent change removed quotes around Vite env vars but when users are online both master and worker sign-ins now fail (offline cached login still works). Investigate and fix the root cause, and return a concise report with any code patches you apply (mask secrets in outputs).

## Context & files to inspect
- `Pro/retail-manager/frontend/.env` (I recently removed surrounding quotes from VITE vars)
- `Pro/retail-manager/frontend/src/integrations/supabase/client.ts`
- `Pro/retail-manager/frontend/src/contexts/AuthContext.tsx`
- `Pro/retail-manager/frontend/src/services/OfflineAuthService.ts`
- `Pro/retail-manager/frontend/src/services/InventoryService.ts` (edge functions usage)
- Dev server: Vite is running. Do not expose secret keys in your reply.

## Observed behavior
- Offline sign-in works (cached).
- When connected to the internet, sign-in attempts for master/worker fail immediately (no session).
- Dev server was restarted after the `.env` change.

## Investigations to run (in order)
1. Runtime env verification
  - In the running app (dev browser console) check and report OK/BAD (do NOT print secrets):
    - `import.meta.env.VITE_SUPABASE_URL`
    - `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`
  - Confirm `createClient` in `client.ts` uses those env vars.

2. Network / sign-in trace
  - Attempt an online sign-in with a dev/test account.
  - Capture the network request (POST to auth endpoint) and the response; mask secrets.
  - Report HTTP status, SDK error object (message/code) or any CORS/TLS issues.

3. Supabase project settings check (dashboard)
  - Ensure allowed origins include `https://localhost:8080`.
  - Confirm `.env` key is the ANON/publishable key (not a service_role key). If key appears invalid/rotated, recommend rotation (masked).

4. Client API & SDK
  - Verify `OfflineAuthService.signIn` uses `supabase.auth.signInWithPassword` correctly.
  - Confirm installed `@supabase/supabase-js` version supports used methods; if not, suggest minimal upgrade or a small shim.

5. CORS / Origin & TLS
  - Look for CORS/preflight or TLS mismatch errors in console and network logs; advise adding origins or adjusting dev TLS if needed.

6. Fallback & error handling
  - Improve `OfflineAuthService.signIn` logging to surface SDK `error` details (message/status) when online auth fails.

## Fix actions (if problem found)
- If env parsing issue remains: fix `Pro/retail-manager/frontend/.env` (remove quotes) and restart dev server.
- If wrong key type: instruct replacing with ANON key; provide `.env` lines to update (do NOT include key values).
- If CORS/origin missing: add `https://localhost:8080` to Supabase allowed origins.
- If SDK version mismatch: propose `npm install @supabase/supabase-js@<min-compatible-version>`.
- If code patch required: apply a single minimal patch and include the patch contents in the report (mask secrets).

## Validation (required)
- After fixes, perform an online sign-in and show masked evidence:
  - `hasSession: true` and `user.id` (mask partially, e.g. `user.id = us***abcd`)
  - `supabase.auth.getSession()` returns same session
  - No network/CORS errors

## Reporting format (concise)
- One-line summary: root cause and fix.
- Bulleted steps performed.
- Files changed (repo-relative paths).
- Evidence of success (masked session id and HTTP 200).
- If unresolved: include masked network request/response and next steps.

## Constraints & safety
- Never print full secret keys or service role values — mask them as `***REDACTED***`.
- Keep fixes minimal and reversible.

Return the full output as a single reply.
