# 📖 Cross-Architecture Build Bible: The Node.js Sidecar Struggle (REVISED 2026)

## 🎯 The Objective
Build a **Universal Windows Application** using Tauri v2 + Node.js Sidecar that runs on:
1.  **x64 (64-bit)**: Native support for modern PCs.
2.  **ARM64**: Support for Surface Pro/Mac M-series (via x64 emulation).
3.  **x86 (32-bit)**: *Deprecated* - Abandoned due to missing native module prebuilds.

## 🏆 The "Final Golden" Solution (Finalized Feb 20, 2026)

After overcoming "Compiling Hell," we have standardized on the **Reliability Stack**.

### 1. The Final Stack (Bible Compliant)
*   **Target Architecture**: `x86_64-pc-windows-msvc` (Works on ARM64 via emulation).
*   **Runtime**: **Node.js v18.20.8 (x64)**.
*   **Database**: **`better-sqlite3` v9.4.3 (ABI 108)**.
*   **Connectivity**: 
    *   **IP-Based**: Standardized on `127.0.0.1:8787` (Avoids `localhost` security quirks).
    *   **Security**: `@tauri-apps/plugin-http` for all local requests (Required for Mixed Content bypass).
    *   **Fallback**: `smartFetch` automatically falls back to standard `fetch` if the plugin is missing/unnecessary (e.g., in Browser).
*   **CORS**: Backend explicitly allows `tauri.localhost`, `tauri://localhost`, and `127.0.0.1`.

### 2. The Sidecar Wrapper (The "Reliable" Guardian)
The Rust wrapper (`backend/sidecar-wrapper`) follows these high-reliability rules:
*   **Emergency Port Cleanup**: Kills any existing process on port 8787 before starting (Fixes "Port already in use" crashes).
*   **Smart Extraction**: Skips re-extracting files to `%TEMP%` if they already exist (Fixes 40-minute Antivirus scanning delays).
*   **Parent Watchdog**: Uses the `sysinfo` crate to monitor the parent process ID. If the main app exits or crashes, the sidecar kills itself immediately (Prevents "Zombie Processes").
*   **Job Objects**: Still uses Win32 Job Objects as a second layer of process cleanup.

### 3. Universal Environment Logic (Mac & Windows Safe)
The backend database initialization (`db.ts`) is now environment-aware:
*   **Development**: Detects Mac/Development mode and uses default binary resolution (Keeps Safari/Chrome testing working).
*   **Production**: Detects Sidecar/Extraction environment and forces the path to the bundled `.node` binary.

### 4. The Build Procedure
Always use the automated script: `scripts/prepare-sidecar-payload.ps1`.

**The Manual Steps (Injected by Script):**
1.  Build Backend TS: `npm run build` in `backend/local-bridge`.
2.  Download **Node v18.20.8 x64** Zip.
3.  Download **BS3 v9.4.3 x64 (ABI 108)** `.node` binary.
4.  Inject `.node` into `node_modules/better-sqlite3/build/Release/`.
5.  Zip the payload AND copy it to `backend/local-bridge/payload.zip` (Required for Tauri Resource compliance).
6.  Compile the Rust wrapper using `cargo build --release --target x86_64-pc-windows-msvc`.

### 4. Tauri Configuration (v2)
*   **`tauri.conf.json`**:
    *   `externalBin`: `["binaries/local-bridge"]`
    *   `permissions`: Use `src-tauri/capabilities/default.json`.
*   **`src-tauri/src/lib.rs`**:
    *   Spawn sidecar using: `shell.sidecar("binaries/local-bridge")`.
    *   **Graceful Spawn**: Do NOT `.unwrap()` the spawn; log errors so the UI can still load.

## ⚠️ Critical Warnings (The "Don't Do This" List)
1.  **No Node 20+**: Do not use Node 20 or higher for the sidecar yet; it breaks compatibility with the proven `better-sqlite3` v9.4.3 binaries.
2.  **No Println**: One single `println!` in the wrapper will break the entire production build on Windows.
3.  **Version Bumping**: When fixing backend issues, bump the version in `tauri.conf.json` (e.g., `0.1.1`) to force the installer to overwrite locked files.
4.  **Target Mismatch**: If you see `NODE_MODULE_VERSION` errors in logs, it means your `node.exe` version and `better_sqlite3.node` ABI version (108 for Node 18) are out of sync.

## 🛠️ Commands
```powershell
# 1. Prepare Sidecar
powershell -ExecutionPolicy Bypass -File scripts/prepare-sidecar-payload.ps1

# 2. Build App
npx tauri build --target x86_64-pc-windows-msvc --bundles nsis
```
