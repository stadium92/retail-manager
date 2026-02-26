# PRD: Optimization & Cleanup

## 1. Overview
This PRD outlines the remaining optimization tasks and recent cleanup efforts. The primary focus is now on optimizing the application for low-end hardware (2.5GB RAM) and ensuring robust error handling.

## 2. Completed Tasks
- **Auth Page**: Localized to French, removed Dev Login buttons.
- **Translations**: Fixed missing keys for Team and Inventory tables.
- **Routing**: Removed redundant `/master/workers` route.
- **UI Fixes**: Addressed reported UI bugs in Invitations and Inventory pages.
- **Refactoring**: Moved inventory logic to a more efficient "changes-only" tracking system.

## 3. Pending Optimization Tasks
- **SQLite FTS5**: Implement Full-Text Search for the product catalog to offload search logic from the frontend to the backend sidecar. This is crucial for reducing RAM usage.
- **Delta Sync**: Implement a robust synchronization strategy that sends only changes (deltas) rather than full objects to minimize bandwidth and processing power.
- **Web Worker**: Offload heavy calculations (e.g., tax, totals) to a Web Worker to keep the UI thread responsive.
- **Rugged Theme**: Implement a high-contrast mode for better visibility in retail environments.

## 4. Resilience Tasks
- **Global Error Boundary**: Implement a React Error Boundary to catch and gracefully handle crashes, especially those related to the sidecar connection or AI service failures.

## 5. Next Steps
1.  Implement **Global Error Boundary**.
2.  Begin **SQLite FTS5** integration in the backend sidecar.
3.  Refactor frontend search to use the new FTS5 endpoint.
