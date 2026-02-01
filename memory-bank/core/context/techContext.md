# Technical Context - Retail Manager

## Technology Stack
- **Frontend**: React (Vite), Tailwind CSS, Shadcn UI.
- **Desktop Wrapper**: Tauri v2 (Migrated from Electron).
- **Local Backend**: Node.js (Fastify) bundled as a **Tauri Sidecar**.
- **Local Database**: SQLite (via `better-sqlite3` and `drizzle-orm`).
- **Cloud Database**: Supabase (PostgreSQL).
- **State Management**: Zustand (to be refactored to SQLite-backed).

## Architecture: Hybrid Offline-First
The application uses a dual-plane data strategy:
1.  **Local Plane**: A standalone binary (LocalBridge) running as a sidecar. It manages a local SQLite database for instant, offline operations.
2.  **Cloud Plane**: Supabase acts as the canonical data source and synchronization hub.

## Hardware Constraints
- **CPU**: Intel Dual Core 2.5GHz.
- **RAM**: 2.5GB.
- **OS**: Windows 10 / macOS.
- **Optimization Strategy**: Tauri's small footprint combined with SQLite-side searching (FTS5) to minimize RAM usage.

## Development Environment
- **Tauri**: Requires Rust and the `@tauri-apps/cli`.
- **Sidecar**: Node.js app packaged with `pkg`.
