# 🚨 Host Agent Action Required: Fix Frontend Dependencies

The Windows VM has successfully fixed the backend connectivity and cleaned up the repository. However, the Frontend on the Host (Mac) is failing because it's missing the newly added `@tauri-apps/plugin-http` dependency and has conflicting lockfiles.

## 🛠️ Execution Plan for Host Agent

Please run the following commands on the Host (Mac) to synchronize and fix the build:

### 1. Pull & Sync Repository
```bash
# Fetch the latest changes from the Windows VM work
git fetch origin
git checkout frontend-test-1
git pull origin frontend-test-1

# Sync the submodule (This is critical)
git submodule update --init --recursive
```

### 2. Clean & Install Frontend Dependencies
```bash
cd frontend

# Ensure you are on the correct submodule branch/commit
git checkout frontend-test-1
git pull origin frontend-test-1

# Remove any lingering conflicting lockfiles (Git should have removed them, but verify)
rm -f bun.lockb pnpm-lock.yaml

# Install dependencies (This installs @tauri-apps/plugin-http)
npm install

# Verify the fix
npm list @tauri-apps/plugin-http
```

### 3. Verification
Run the dev server to confirm the error is gone:
```bash
npm run dev
```

## 📝 Summary of Fixes (For Context)
*   **Dependency Added**: `@tauri-apps/plugin-http` (v2.5.7) was added to `package.json` to support the new `smartFetch` logic.
*   **Lockfile Cleanup**: Removed `bun.lockb` and `pnpm-lock.yaml` to standardize on `package-lock.json` (npm).
*   **Connectivity**: The frontend now uses `smartFetch` to automatically route requests to the local sidecar (127.0.0.1:8787) when running in Tauri, solving the "Failed to Fetch" error.
