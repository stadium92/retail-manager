# Build Incident Note: macOS Launch & Logging

## Date: January 31, 2026
## Resolved: February 04, 2026

## Incident Description
During the initial testing phase after migrating from Electron to Tauri v2, we attempted to build and launch the application on a MacBook (macOS aarch64-apple-darwin). The goal was to verify that the frontend and the `LocalBridge` sidecar launch simultaneously and communicate correctly.

## Issues Encountered
1.  **Launch Failure**: The application fails to start properly or the backend sidecar does not initialize as expected.
2.  **Missing Logs**: The most critical issue is that **loggings are not working**. There is no stdout/stderr output from the sidecar being captured or displayed, preventing any effective debugging of the launch sequence.
3.  **Verification Gap**: Because the app cannot launch, we cannot verify if the offline/local backend logic is functional in the new Tauri environment.
4.  **Backend Crash**: The sidecar was crashing with `SyntaxError: Cannot use import statement outside a module` when packaged.

## Resolution (Feb 4, 2026)
The issue was identified as an incompatibility between `pkg` (used for packaging the Node.js sidecar) and ES Modules (`import/export`) in the specific build environment.

**Fix Implemented:**
1.  **Switch to CommonJS**: Modified `backend/local-bridge/tsconfig.json` to change `"module": "ESNext"` to `"module": "CommonJS"`. This forces the TypeScript compiler to output `require()` syntax, which `pkg` handles natively.
2.  **Seed Script Update**: Updated `backend/local-bridge/src/seed.ts` to replace ESM-specific checks (`import.meta.url`) with CommonJS equivalents (`require.main === module`).
3.  **Rebuild**: Rebuilt the sidecar and the Tauri bundle. The application now launches correctly, and the backend is fully functional (sign-in, account creation, etc.).

## Context for Future Assistants
- **Backend Build**: The `local-bridge` MUST be compiled to CommonJS for the `pkg` build step to work correctly. Do not revert `tsconfig.json` to `ESNext` without verifying `pkg` support.
- **Sidecar Pathing**: `pkg` config in `package.json` now correctly points to the `dist` folder.