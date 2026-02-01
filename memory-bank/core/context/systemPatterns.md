# System Patterns - Retail Manager

## Architecture Patterns
- **Tauri Sidecar Pattern**: The Node.js `LocalBridge` is compiled into a platform-specific binary and launched by the Tauri Rust core. This isolates the business logic from the UI thread and reduces memory overhead.
- **Adapter Pattern**: A `DataClientAdapter` abstracting the choice between `Supabase` and `LocalBridge` based on `APP_MODE`.
- **Delta-Based Sync (Planned)**: Using a mutation journal to sync changes rather than state.

## Interaction Patterns
- **Thin Client**: The React frontend is designed to be a view layer for the SQLite database, fetching windowed data to keep DOM and memory usage low.
- **Vim-style Navigation (Planned)**: Keyboard-heavy shortcuts for high-speed retail operations.

## Data Patterns
- **FTS5 Searching**: Utilizing SQLite's built-in full-text search for item lookups.
- **Optimistic UI**: Immediate local updates followed by background synchronization.
