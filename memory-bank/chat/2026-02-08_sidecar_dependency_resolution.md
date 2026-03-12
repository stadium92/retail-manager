# Sidecar Dependency and Path Resolution Log
**Timestamp:** 2026-02-08 15:30 (Session ID: 771dcc52)

## Overview
Resolved a critical issue where the installed Retail Manager application failed to fetch data from the backend. The root cause was a combination of missing transitive dependencies in the sidecar payload and incorrect resource path mapping in Tauri.

## Journey: A to Z

### 1. Problem Discovery
- **Symptoms:** App launches, but all network requests to `localhost:8787` fail with "Failed to fetch data".
- **Investigation:** Checked `%TEMP%\retail-manager-sidecar`. Files existed, but no `node.exe` process was running.

### 2. Diagnosis (The "Aha!" Moment)
- **Manual Execution:** Attempted to run the backend manually from the temp folder:
  ```powershell
  cd $env:TEMP\retail-manager-sidecar
  .\node.exe .\dist\index.js
  ```
- **Error:** `Error: Cannot find module 'fastq'`.
- **Root Cause:** The `prepare-sidecar-payload.ps1` script used a manual whitelist of `node_modules`. It included `fastify` but missed transitive dependencies like `fastq` (required by `avvio`, which is required by `fastify`).

### 3. Iterative Fixes
- **Fix 1 (Dependencies):** Updated the PowerShell script to copy the *entire* `node_modules` folder into the payload.
- **Fix 2 (Logging):** Added emergency file-based logging to `backend/local-bridge/src/index.ts` to write startup status to `%LOCALAPPDATA%\retail-manager-logs\backend-startup.log`.
- **Fix 3 (Resource Path):** Discovered `tauri.conf.json` was looking for `payload.zip` in the wrong relative path. Corrected it to `../backend/local-bridge/payload.zip`.
- **Fix 4 (File Locks):** Encountered "Access Denied" errors during bundling because the previous installer `.exe` was still open. Closed the installer and killed stale processes.

### 4. Final Solution
- Rebuilt the sidecar with all dependencies.
- Re-compiled the Rust wrapper embedding the full payload.
- Verified the final installer size increased (~100MB+), confirming full dependency inclusion.

## Lessons Learned & Future Thinking
1. **Don't Over-Optimize Too Early:** Whitelisting `node_modules` is brittle. When building offline-first sidecars, favor completeness over small size until stability is proven.
2. **Sidecar Visibility:** Rust sidecars fail silently in Tauri if not piped. Always include internal logging to a file that persists on the user's system for field diagnostics.
3. **Architecture Awareness:** Building 32-bit apps on ARM64 hosts requires strict path management and toolchain discipline. Always use absolute paths in build scripts to avoid "Command not found" or "Manifest not found" errors.

## Context Index
- [Previous Sidecar Strategy](../tech/sidecar_wrapper_strategy.md)
- [Current Resolution (This File)](2026-02-08_sidecar_dependency_resolution.md)
