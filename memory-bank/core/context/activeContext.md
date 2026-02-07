# Active Context - Retail Manager

## Current Focus
The Windows 32-bit build was **successfully generated**, but runtime testing has revealed critical issues:
1.  **Database Error:** "Database error saving new user".
2.  **Activation UI Missing:** The app appears unlocked (vaults present) without the activation prompt/countdown.
3.  **Cross-Platform Commit:** Need to save changes without breaking macOS compatibility.

## Current Blockers
- **Database Path on Windows:** Suspect `env.ts` is using Linux-style paths (`.local/share`) on Windows instead of `AppData`, causing permission or path errors.
- **Activation Logic Regression:** Need to identify why the license prompt is bypassed.

## Recent Changes
- **Tauri Build Success:** Successfully built `retail-manager_0.1.0_x86_en-US.msi` targeting `i686-pc-windows-msvc`.
- **Configuration Recovery:** Re-created missing `tauri.conf.json`, `Cargo.toml`, and generated icons using `npx tauri icon`.
- **Code Fixes:** Patched `src-tauri/src/lib.rs` for `tauri-plugin-log` v2 compatibility.
- **Windows Sidecar Strategy Pivot**: Abandoned `pkg` for Windows 32-bit builds due to missing upstream binaries and deprecation.
- **Rust Sidecar Wrapper**: Implemented a custom Rust executable (`backend/sidecar-wrapper`) that embeds a zipped Node.js 18 (x86) environment and extracts it at runtime.

## Next Steps
- **Fix Database Path:** Modify `backend/local-bridge/src/env.ts` to use `APPDATA` or `LOCALAPPDATA` on Windows.
- **Restore Activation UI:** Investigate `App.tsx` and `LicenseService.ts` integration.
- **Commit Code:** Commit changes to git, ensuring no heavy binaries are included.

## Technical Decisions
- **Rust Wrapper for Sidecar**: Adopted a "Self-Extracting Launcher" pattern using Rust (`zip` crate) to package the Node.js backend. This provides full control over the runtime environment and avoids external dependency failures (like `pkg` 404s).
- **One Action Per Key**: Updated mapping logic to ensure an action is only assigned to one function key at a time.
- **English-Only Logs**: All technical/audit logs remain in English for developer debugging.