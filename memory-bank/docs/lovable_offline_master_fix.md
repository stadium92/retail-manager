# Prompt: Fix Master Offline Issues & Auth

**Context**: The Master Dashboard fails to load critical sections (Inventory, Sales, Team) when offline because they fetch directly from Supabase. Additionally, deleting workers offline fails, and there are friction points with offline login.

**Objective**: 
1. Refactor Master pages to be **Offline-First**.
2. Fix Team Management (Add/Delete) to work offline.
3. Ensure Offline Login works seamlessly for locally created users.

## 1. Refactor Master Pages (Offline-First)

Refactor the following files to use `LocalDatabase` (indexedDB) or Offline Services instead of `supabase.from(...)`. 
*Pattern*: Load from Local DB first, then try to sync/fetch fresh data in background if online.

### A. Team Management (`src/pages/master/Team.tsx`)
- **Fetch**: Use `OfflineTeamService.getMembers()`.
- **Delete**: Use `OfflineTeamService.deleteMember()`.
    - **Fix**: Ensure `deleteMember` in `OfflineTeamService` updates the local state immediately and queues the deletion if offline.
- **Add**: Ensure the "Add Member" flow uses `OfflineAuthService.createUser` which supports offline creation (already implemented, just ensure UI uses it).

### B. Inventory (`src/pages/master/Inventory.tsx`)
- **Fetch**: Use `LocalDatabase.getInventory()` (or products store).
- **Edit**: Ensure edits update local DB and queue sync items.

### C. Sales (`src/pages/master/Sales.tsx` or similar)
- **Fetch**: Use `LocalDatabase.getSales()`.
- **Metrics**: KPIs must be calculated from local data when offline.

## 2. Fix "Deleted Worker" Issue
- **Root Cause**: The UI likely depends on a live Supabase subscription or re-fetch which fails offline.
- **Solution**: When `deleteMember` is called:
    1. Mark user as `deleted` in `LocalDatabase` (add a `deleted` flag to `LocalUser` or remove record).
    2. Update local React state (remove from list) immediately.
    3. Add `user_delete` job to `SyncQueue`.

## 3. Offline Login & "First Connect" Requirement
- **Requirement**: The user should NOT need to go online *once* if they created the user offline on the same device.
- **Verification**: 
    - Check `OfflineAuthService.signIn`. It fetches from `LocalDatabase`.
    - Ensure `createUser` saves the password hash correctly to `LocalDatabase`.
    - **Fix**: If the user is created *offline*, the `LocalUser` record exists. `signIn` should succeed using `verifyPassword`.
    - **Edge Case**: If the app is uninstalled or cache cleared, local users are lost. This is expected behavior for web/PWA.
    - **Action**: Add a "Local Admin" setup wizard if the DB is empty and offline? (Optional, stick to fixing the existing flow first).

## 4. "Online Workers Unavailable" Bug
- **Issue**: Workers don't show up when online.
- **Potential Cause**: RLS Policy mismatch or `store_id` filtering.
- **Action**: 
    - Ensure the query `supabase.from('profiles').select('*')` includes the correct `store_id` filter matching the logged-in Master's store.
    - Check if `OfflineTeamService` syncs *down* workers from Supabase when online. If not, the local DB might be empty on a fresh online device. **Implement `syncTeamFromSupabase`** in `OfflineTeamService`.

**Deliverables**:
- Refactored `Team.tsx`, `Inventory.tsx`.
- Updated `OfflineTeamService.ts` (Sync logic).
- Fix for Offline Deletion logic.
