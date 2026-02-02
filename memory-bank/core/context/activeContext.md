# Active Context - Retail Manager

## Current Focus
Evolving the project by integrating DeepSearch audit results and finalizing the Offline-First/Hybrid refactor. The primary goal is ensuring performance on low-end hardware (Dual Core, 2.5GB RAM) and completing Phase 3 (Reliability & Packaging) of the refactor.

## Current Blockers
- **macOS Build Failure**: Attempts to launch the app on MacBook for backend verification are currently failing.
- **Sidecar Synchronization**: Issues with the simultaneous launch of the Tauri frontend and the Node.js LocalBridge sidecar.

## Recent Changes
- **Restored Loggings**: Implemented robust logging for both the Rust core and the Node.js sidecar using `tauri-plugin-log`. Sidecar stdout/stderr is now piped to Tauri logs.
- Removed all Electron dependencies, configuration, and legacy documentation.
- Migrated from Electron to Tauri v2 for improved performance on low-end hardware.
- Bundled the Node.js LocalBridge as a standalone binary sidecar within Tauri.
- Initialized Memory Bank core files (`tasks.md`, `activeContext.md`, `projectbrief.md`).

## Next Steps
- **Debug macOS Launch**: Fix the orchestration between Tauri and the LocalBridge sidecar (now possible with logs).
- Implement SQLite FTS5 for zero-memory catalog searching.
- Refactor Zustand state to use SQLite-backed virtualization.

## Technical Decisions
- **Migration to Tauri v2**: Decided for performance on low-end hardware.
- **SQLite as Primary Local State**: Moving away from large in-memory Zustand stores.
- **Node.js Sidecar**: Keeping LocalBridge as a sidecar for business logic centralization.
