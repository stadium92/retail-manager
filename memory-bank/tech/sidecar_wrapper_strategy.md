# Sidecar Build Strategy: Rust Wrapper Pattern

## Context
The Retail Manager backend (`local-bridge`) is a Node.js server. For production deployment on 32-bit Windows machines from an ARM64 host (Windows on ARM/Parallels), standard packaging tools like `pkg` are unreliable as they attempt to compile Node.js from source.

The **Rust Wrapper Pattern** provides a robust, self-contained solution by embedding the entire backend environment into a single executable.

## The A to Z Procedure

### 1. Backend Compilation (The Brains)
- **Action:** Compile TypeScript to JavaScript.
- **Command:** `npm run build` in `backend/local-bridge`.
- **Result:** A `dist/` folder containing the obfuscated logic.

### 2. Runtime Acquisition (The Engine)
- **Action:** Download the official 32-bit (x86) Node.js Windows binary (`node.exe`).
- **Why:** This ensures the app carries its own "engine" and doesn't rely on the user having Node.js installed.

### 3. Payload Generation (The Suitcase)
- **Action:** Bundle `node.exe`, `dist/`, and essential `node_modules/` (like `better-sqlite3`) into `payload.zip`.
- **Optimization:** Only include mandatory modules to keep the file size manageable and avoid zipping timeouts.

### 4. Rust Wrapper logic (The Shim)
- **Mechanism:** Use Rust's `include_bytes!` macro to embed `payload.zip` directly into the Rust binary at compile time.
- **Runtime Logic:**
  1. Create a unique temporary directory.
  2. Extract `payload.zip` into that directory.
  3. Spawn the bundled `node.exe` to run the `dist/index.js`.
  4. Keep the wrapper alive as a proxy process for Tauri.

### 5. Cross-Compilation Setup (The Linker)
- **Challenge:** ARM64 Windows cannot natively link x86 binaries without the correct environment.
- **Solution:** 
  1. Install the **x86 toolchain** for Rust (`rustup default stable-i686-pc-windows-msvc`).
  2. Load the **arm64_x86 cross-tools** from Visual Studio via `vcvarsall.bat`. This allows the ARM64 host to use x86 libraries.

### 6. Tauri Naming Convention (The Final Step)
- **Constraint:** Tauri expects sidecar binaries to follow the format: `<name>-<target-triple>.exe`.
- **Action:** Rename the resulting wrapper to `local-bridge-i686-pc-windows-msvc.exe` and place it in `src-tauri/binaries/`.

## Automation
This entire process is automated via the script:
`scripts/prepare-sidecar-payload.ps1`

## Key Lessons Learned
- **Don't use `pkg`:** It is deprecated and fails on cross-architecture source builds.
- **Host vs Target:** On ARM64, always ensure the MSVC environment is explicitly set to `arm64_x86` for 32-bit linking.
- **Tauri Strictness:** Sidecar filenames must match the target triple exactly or the frontend will fail to connect.
