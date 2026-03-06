# Prompt for Claude Agent: Surgical Supabase Removal

**Context:** We are migrating "Retail Manager" from a hybrid (Supabase + Local Bridge) architecture to a **Pure Local-First architecture**. The cloud sync will eventually be handled by a custom Rust API. For now, we need to completely sever the frontend's direct dependency on the `supabase-js` client.

**Goal:** Strip out all direct Supabase calls from the frontend codebase. The frontend must rely **100%** on the `localBridgeBaseUrl` and the `LocalDatabase` (IndexedDB).

**CRITICAL RULES:**
1. **Do NOT break local logic:** Most functions currently look like `if (isLocalFirst) { /* call local bridge */ } else { /* call supabase */ }`. Your job is to **keep** the local bridge logic and **delete** the Supabase logic.
2. **Graceful Fallbacks:** If a function *only* existed to talk to Supabase (e.g., fetching global stats that the local bridge doesn't have yet), replace it with a graceful fallback (return empty array/null) or a simple local DB query. Do not leave broken functions.
3. **No UI Changes:** Do not alter any React components, CSS, or translations. This is a pure data-layer refactor.

### Step-by-Step Execution Plan:

#### 1. Update `src/lib/dataClient.ts`
- Remove the `createClient` import from `@supabase/supabase-js`.
- Remove the `supabase` client initialization.
- Modify the `getDataClient()` function. It should no longer return a `supabase` instance. `isLocalFirst` can be hardcoded to `true` (or the logic simplified since it's now *always* local-first).

#### 2. Clean up Authentication (`OfflineAuthService.ts`)
- Remove all `supabase.auth...` calls.
- The app must now rely strictly on `localBridgeSignIn`, `localBridgeSignUp`, and IndexedDB session caching.
- If there are functions syncing users to Supabase (`SupabaseProvisioningService.ts`), delete them or render them inert.

#### 3. Clean up Data Services (`OfflineDataService.ts`, `OfflineInventoryService.ts`, `OfflineSalesService.ts`, `OfflineStoreService.ts`, `OfflineTeamService.ts`)
- Search for `import { supabase }` and remove it from all these files.
- Remove all `navigator.onLine` checks that trigger `supabase.from(...).select()`. 
- For Background Sync logic (e.g., `this.shouldSync(...)`), keep the part that fetches from `localBridgeBaseUrl`, but remove the `else if (navigator.onLine)` block that queries Supabase directly.

#### 4. Remove Supabase Dependencies
- In `package.json`, remove `@supabase/supabase-js`.
- Delete the `src/integrations/supabase` folder entirely as it is no longer needed.

#### 5. Verification
- Run `npm run build` in the `frontend` directory to ensure no TypeScript errors remain regarding missing `supabase` properties on the `getDataClient()` return type.

**Execute these steps carefully. You are a senior software architect; prioritize application stability and ensure the local offline functionality remains 100% intact.**
