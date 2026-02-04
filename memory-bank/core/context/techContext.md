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

## Multi-Platform Build Architecture

### Build vs. Development Node Versions
The project uses `pkg` to bundle the backend sidecar, which targets **Node 18**. However, local development typically uses a newer version (e.g., **Node 20**).

- **Production Build (Mac)**: 
  1. Run `npm run tauri:build` from the root. 
  2. This uses `scripts/build-sidecar.sh` to package `local-bridge-aarch64-apple-darwin`.
- **Production Build (Windows 32-bit)**:
  1. Must be run inside a **Windows VM (Parallels)**.
  2. Run `.\scripts\build-sidecar.ps1` in PowerShell to package the 32-bit sidecar (`local-bridge-i686-pc-windows-msvc.exe`).
  3. Run `tauri build --target i686-pc-windows-msvc` to generate the `.exe`.
- **Local Development**: After any production build, run `cd backend/local-bridge && npm rebuild better-sqlite3` to restore the native module for Node 20.

### Target Specifications
- **macOS**: `aarch64-apple-darwin` (Apple Silicon).
- **Windows**: `i686-pc-windows-msvc` (32-bit x86). Targeted for maximum compatibility with low-end hardware (2.5GB RAM).
- **Backend**: Compiled to **CommonJS** for `pkg` compatibility.
