# Dynamic Port Discovery Strategy

## Context
To ensure the Retail Manager app functions correctly across different computers without manual port configuration or conflicts, we planned a "Discovery" mechanism. This allows the backend to bind to any available port and the frontend to find it automatically.

## Proposed Implementation

### 1. Backend (The Server)
- **Binding:** The Fastify server should attempt to bind to the default port (8787).
- **Fallback:** If 8787 is in use (EADDRINUSE), bind to port `0`, which tells the OS to assign any random free port.
- **Reporting:** After binding, the backend writes the actual port number to a local file:
  - **Path:** `%APPDATA%/retail-manager/data/active_port.txt` (Windows)
  - **Content:** Just the port number (e.g., `54321`)

### 2. Frontend (The UI)
- **Discovery:** On startup, the React app (running inside Tauri) uses the Tauri `fs` API to check for the existence of `active_port.txt`.
- **Initialization:**
  - If the file exists, read the port and update the `localBridgeBaseUrl` in `dataClient.ts`.
  - If it doesn't exist (e.g., first start), retry for a few seconds or fall back to the default (8787).
- **Provider:** Wrap the app in a `DynamicBridgeProvider` that blocks the UI until the port is discovered, showing a "Connecting..." splash screen.

## Advantages
- **Conflict Free:** No more "Port 8787 already in use" errors.
- **Zero Config:** Works on any computer regardless of its network setup.
- **Stability:** Ensures the "Internal Bridge" between UI and Data is always established.

## Status
- **Current State:** REVERTED (to maintain build stability).
- **Ready for:** Post-32-bit stable build testing.
