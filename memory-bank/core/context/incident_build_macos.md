# Build Incident Note: macOS Launch & Logging

## Date: January 31, 2026

## Incident Description
During the initial testing phase after migrating from Electron to Tauri v2, we attempted to build and launch the application on a MacBook (macOS aarch64-apple-darwin). The goal was to verify that the frontend and the `LocalBridge` sidecar launch simultaneously and communicate correctly.

## Issues Encountered
1.  **Launch Failure**: The application fails to start properly or the backend sidecar does not initialize as expected.
2.  **Missing Logs**: The most critical issue is that **loggings are not working**. There is no stdout/stderr output from the sidecar being captured or displayed, preventing any effective debugging of the launch sequence.
3.  **Verification Gap**: Because the app cannot launch, we cannot verify if the offline/local backend logic is functional in the new Tauri environment.

## Context for Future Assistants
If you are tasked with fixing the build:
- Focus on the `src-tauri/src/lib.rs` sidecar spawning logic.
- Investigate why the `tauri-plugin-log` or standard sidecar output piping is failing.
- Ensure the `LocalBridge` binary has the correct permissions and environment variables when launched by Tauri.
