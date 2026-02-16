# 📖 Cross-Architecture Build Bible: The Node.js Sidecar Struggle

## 🎯 The Objective
Build a **Universal Windows Application** using Tauri + Node.js Sidecar that runs on:
1.  **x64 (64-bit)**: Native support for modern PCs.
2.  **ARM64**: Support for Surface Pro/Mac M-series (via x64 emulation).
3.  **x86 (32-bit)**: Legacy support (deprecated but attempted).

## 🌋 The "Living Hell" (What We Learned)

### 1. The Architecture Mismatch
*   **The Trap**: Building on an ARM64 host automatically installs ARM64 native modules (`better-sqlite3`).
*   **The Error**: `better_sqlite3.node is not a valid Win32 application`. This occurs when a 32-bit or 64-bit Node.js process tries to load a module compiled for a different CPU architecture (ARM64).

### 2. The Dependency Version Conflict
*   **Version Trap**: `better-sqlite3` v12.x requires Node.js 20+.
*   **Project Requirement**: The backend code is optimized for Node.js 18.
*   **The Crash**: Trying to run Node 18 with `better-sqlite3` v12 causes immediate runtime failure.

### 3. The Tooling Failure
*   **Python Requirement**: `node-gyp` (used by npm to build native modules) requires Python. On many low-end or fresh Windows installs, Python is missing, causing `npm install` to fail if it can't find a pre-built binary.
*   **Prebuild Scarcity**: `better-sqlite3` does **NOT** provide pre-built 32-bit (ia32) binaries for modern Node versions (18/20) on their GitHub releases.

## 🏆 The "Golden" Solution (The Breakthrough)

We abandoned 32-bit (x86) because of the missing library support and standardized on **x64 (64-bit)**. 

### The Final Stack:
*   **Runtime**: Node.js v18.20.8 (x64).
*   **Database**: `better-sqlite3` v9.4.3.
*   **Why?**: v9.4.3 is the latest version that reliably provides **pre-built x64 binaries** for Node 18, avoiding the need for Python or local compilation.

### The "Manual Injection" Pattern:
Since `npm install` gets confused by the ARM64 host, the build script now uses a "Manual Injection" pattern:
1.  Download Node.js x64 zip.
2.  Run `npm install --ignore-scripts` (skips building native modules).
3.  **Manually download** the exact `.node` binary from GitHub Releases.
4.  **Force-inject** it into `node_modules/better-sqlite3/build/Release/`.

## 🛠️ Maintenance & Build Procedure

### Build Script Location
`scripts/prepare-sidecar-payload.ps1`

### Verified Binary URL (Node 18 x64)
`https://github.com/WiseLibs/better-sqlite3/releases/download/v9.4.3/better-sqlite3-v9.4.3-node-v108-win32-x64.tar.gz`

### To Rebuild:
1.  Run `powershell -ExecutionPolicy Bypass -File scripts/prepare-sidecar-payload.ps1`.
2.  Run `npx tauri build --target x86_64-pc-windows-msvc`.

## ⚠️ Critical Warnings
*   **NEVER** upgrade `better-sqlite3` beyond v9.4.3 unless you verify x64 prebuilds exist for the target Node version.
*   **NEVER** rely on `npm install` to build native modules on the ARM64 machine for x64/x86 targets; it will fail due to missing Python or path confusion. Always use the **Manual Injection** pattern.
