# 📖 Cross-Architecture Build Bible: The Node.js Sidecar Struggle (REVISED 2026)

## 🎯 The Objective
Build a **Universal Windows Application** using Tauri v2 + Node.js Sidecar that runs on:
1.  **x64 (64-bit)**: Native support for modern PCs.
2.  **ARM64**: Support for Surface Pro/Mac M-series (via x64 emulation).
3.  **x86 (32-bit)**: *Deprecated* - Abandoned due to missing native module prebuilds.

## 🏆 The "Final Golden" Solution (Finalized Feb 17, 2026)

After a long struggle with "Failed to Fetch" errors and silent crashes, we standardized on this exact stack.

### 1. The Final Stack (Bible Compliant)
*   **Target Architecture**: `x86_64-pc-windows-msvc` (Works on ARM64 via emulation).
*   **Runtime**: **Node.js v18.20.8 (x64)**.
*   **Database**: **`better-sqlite3` v9.4.3 (ABI 108)**.
*   **Security**: `@tauri-apps/plugin-http` for all backend requests (bypasses WebView CORS).
*   **CORS**: Backend MUST use `origin: '*'` with wildcard.

### 2. The Sidecar Wrapper (The "Silent" Guardian)
The Rust wrapper (`backend/sidecar-wrapper`) must follow these rules:
*   **No Console Output**: NEVER use `println!` or `eprintln!`. On Windows, if the app is launched without a console (the default), these calls will cause a "Broken Pipe" panic and kill the backend instantly. Use file logging only.
*   **Job Objects**: Use Win32 Job Objects to ensure the Node.js process is killed when the main app closes.
*   **Extraction**: Extract the payload to `%TEMP%\retail-manager-sidecar`.

### 3. The Build Procedure
Always use the automated script: `scripts/prepare-sidecar-payload.ps1`.

**The Manual Steps (Injected by Script):**
1.  Build Backend TS: `npm run build` in `backend/local-bridge`.
2.  Download **Node v18.20.8 x64** Zip.
3.  Download **BS3 v9.4.3 x64 (ABI 108)** `.node` binary.
4.  Inject `.node` into `node_modules/better-sqlite3/build/Release/`.
5.  Zip the payload and compile the Rust wrapper using `cargo build --release --target x86_64-pc-windows-msvc`.

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
