# Audit Document 1: Authentication & Store Inheritance

## Context
The Retail Manager app uses a "Local-First" architecture. The frontend connects to a local sidecar backend (`local-bridge`), which then syncs data to Supabase.

## The "New Store" Bug (Fixed)
Previously, when a cloud user (like a worker) logged in, they often lacked a strictly defined `store_id` in their Supabase `user_metadata`. 
When `OfflineAuthService.localBridgeSignIn` fell back to Supabase, it would successfully authenticate but pass `store_id: null` to the local bridge's `/auth/sync-cloud-login` endpoint.
Because the local bridge saw a `null` store ID, it would randomly generate a **new, empty store** for that user on the local device (`db.insertStore()`).
This resulted in **fragmented stores** on the same machine: the original bootstrapped store with products, and the new empty store for the worker.

## The Fix Implemented
In `backend/local-bridge/src/routes/auth.ts`, both `/auth/sync-cloud-login` and `/auth/bootstrap-cloud` were updated to implement **Local Store Inheritance**:
```typescript
    let finalStoreId = store_id || null;
    
    // Prevent fragmentation by prioritizing existing local store on this device
    if (!finalStoreId) {
        const allLocalStores = db.listStores();
        if (allLocalStores.length > 0) {
            finalStoreId = allLocalStores[0].id; // Inherit the machine's store
        }
    }
```

## Online-First with Offline Fallback
In `frontend/src/services/OfflineAuthService.ts`, the `localBridgeSignIn` method was refactored:
1. **Online-First:** It now tries `supabase.auth.signInWithPassword` first. If successful, it securely syncs the cloud credentials down to the local bridge.
2. **Offline Fallback:** If the network request fails (e.g., offline), it catches the network error and falls back to local bridge authentication (`/auth/login`).
3. **Session Retention:** If the sidecar is still booting and returns `ECONNREFUSED` during a token refresh (`refreshLocalBridgeSession`), the app now safely returns the expired cached session instead of nullifying it. This prevents the user from being randomly logged out on boot without internet.

## What Claude Needs to Know
If the user complains that "credentials aren't recognized", ensure they are running the **latest compiled version** of the app. Older installed binaries (`.app` / `.dmg`) will still execute the fragmented store logic, causing local login to reject users who exist in the cloud but were incorrectly saved locally.
