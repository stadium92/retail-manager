# Active Context - Retail Manager

## Current Focus
Evolving the project by integrating DeepSearch audit results and finalizing the Offline-First/Hybrid refactor. The primary goal is ensuring performance on low-end hardware (Dual Core, 2.5GB RAM) and completing Phase 3 (Reliability & Packaging) of the refactor.

## Recent Changes
- Initialized Memory Bank core files (`tasks.md`, `activeContext.md`, `projectbrief.md`).
- Integrated DeepSearch audit tasks into the main task list.
- Reviewed and mapped out the status of the Offline + Hybrid Refactor plan.

## Next Steps
- Begin Phase 3 of the Offline + Hybrid Refactor.
- Implement Tauri v2 migration to replace Electron for better resource management.
- Refactor Zustand state to use SQLite-backed virtualization.

## Technical Decisions
- **Migration to Tauri v2**: Decided for performance on low-end hardware.
- **SQLite as Primary Local State**: Moving away from large in-memory Zustand stores.
- **Node.js Sidecar**: Keeping LocalBridge as a sidecar for business logic centralization.
