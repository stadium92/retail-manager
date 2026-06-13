# Audit Document 2: Sync Engine Architecture

## Context
The application does **not** rely on Supabase Edge Functions or external cloud workers to sync data. Instead, it relies on an embedded background worker running inside the React frontend: `LocalBridgeSyncService.ts`.

## How the Sync Works
1. **Trigger:** `AuthContext.tsx` monitors the `roles` array. If a user logs in and their role contains a valid `store_id`, it automatically calls `LocalBridgeSyncService.start(storeId)`.
2. **Push Mechanism:** 
   - Every time a mutation happens locally (e.g., creating a sale), `LocalBridgeSyncService` does not immediately push to Supabase.
   - Instead, the SQLite backend (`local-bridge`) emits an event and inserts a row into the local `sync_outbox` table.
   - Every 5 seconds, the `LocalBridgeSyncService` (running in the React frontend) polls `/sync/outbox` on the local bridge.
   - It takes batches of up to 100 rows and upserts them sequentially into Supabase.
   - Once successfully pushed to Supabase, it calls `/sync/outbox/status` to mark them as `status = 'acked'` locally.

## Supabase Rate Limits
- The worker polls the outbox every 5 seconds.
- Supabase allows up to 1,000 API requests per second on the free tier.
- 12 requests per minute per device is well within safe limits and will not cause API blocking. There is absolutely no need to moderate it or move to edge functions.

## What Claude Needs to Know
If data is not pushing to Supabase, check the following:
1. Is `sync_outbox` populated in the local SQLite DB? If it is empty, the user has not generated any mutations, or the repo is failing to call `emitOutbox()`.
2. Is `store_id` null for the user? If `store_id` is null, `LocalBridgeSyncService.start(storeId)` is never called, so the worker never wakes up.
3. Check the DevTools console for `[LocalBridgeSyncService]` logs. It logs every push and merge operation.
