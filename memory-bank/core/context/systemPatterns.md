# System Patterns - Retail Manager

## Architecture Patterns
- **Tauri Sidecar Pattern**: The Node.js `LocalBridge` is compiled into a platform-specific binary and launched by the Tauri Rust core. This isolates the business logic from the UI thread and reduces memory overhead.
- **Adapter Pattern**: A `DataClientAdapter` abstracting the choice between `Supabase` and `LocalBridge` based on `APP_MODE`.
- **Delta-Based Sync (Planned)**: Using a mutation journal to sync changes rather than state.

## Interaction Patterns
- **Thin Client**: The React frontend is designed to be a view layer for the SQLite database, fetching windowed data to keep DOM and memory usage low.
- **Context-Aware Keyboard Shortcuts**: Global `keydown` listener managed by `ShortcutsContext`. Intercepts F-keys (F1-F12) based on active module to replicate legacy POS efficiency.
- **Retro-DOS Help System**: F1 triggers a high-contrast, text-heavy overlay for rapid documentation access.

## Data Patterns
- **FTS5 Searching**: Utilizing SQLite's built-in full-text search for item lookups.
- **Optimistic UI**: Immediate local updates followed by background synchronization.
- **English-Only Audit Logging**: All system-level events and technical logs are recorded strictly in English to facilitate cross-locale debugging and support.

## System Stability & AI Safety Protocols
To prevent system-breaking "optimizations" experienced in previous iterations, all AI agents must adhere to the following **Strict Negative Constraints**:

1.  **NEVER Disable Core Services**: Do not stop or disable Windows services related to networking (`Netman`, `nlasvc`, `Dhcp`, `Dnscache`, `BFE`), hardware management, or Parallels integration.
2.  **NO Driver or Service Deletion**: Never use `sc delete` or commands that physically remove services or drivers from the registry.
3.  **Network Integrity**: Do not modify the state of network adapters (`Disable-NetAdapter`). The virtual bridge between the Mac and VM is mission-critical.
4.  **Safe Space Optimization**: Optimization efforts must be limited to:
    -   Deleting temporary build files (`dist/`, `target/`, `node_modules/`).
    -   Using the Windows "Disk Cleanup" utility.
    -   Recommending the **Parallels "Compress Disk"** tool (manual action by user).
5.  **Persistence Protection**: Do not modify Registry keys in `HKLM:\SYSTEM\CurrentControlSet\Services` without explicit user confirmation for a non-system service.

Failure to follow these protocols results in a bricked development environment. Prioritize stability over incremental disk space gains.
