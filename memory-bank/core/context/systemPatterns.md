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
