<context>
# Overview  
The **Retail Manager Deep Evolution & Optimization** PRD outlines a strategic refactor and feature enhancement suite designed to transform the current Retail Manager into a high-performance, resilient, and intelligent POS system. It specifically addresses the critical "Dual Core / 2.5GB RAM" hardware constraint by moving from a memory-heavy React architecture to a "Thin-Client" model backed by a highly optimized local SQLite engine. It also evolves the user experience from basic recording to proactive AI-driven consultation.

# Core Features  

### 1. Delta-Based Synchronization (Conflict-Resistant)
- **What it does**: Instead of syncing the final state of an item, it syncs the *change* (e.g., -2 items).
- **Why it's important**: Prevents data loss and inventory inaccuracies when multiple tellers work offline simultaneously.
- **How it works**: Uses a "Mutation Journal" in SQLite. When syncing, it applies atomic increments/decrements to the cloud database.

### 2. Reactive SQLite Search (Zero-Memory Catalog)
- **What it does**: Moves product searching and filtering from React state to SQLite FTS5 (Full-Text Search).
- **Why it's important**: Crucial for 2.5GB RAM machines. It allows handling 100k+ products without increasing the app's memory footprint.
- **How it works**: React Query sends search strings to the LocalBridge sidecar, which executes an FTS5 query and returns only the first 50 results (windowed).

### 3. Proactive AI "Shadow Prompting"
- **What it does**: Automatically generates business insights in the background based on the 30-day data threshold.
- **Why it's important**: Owners often don't know what to ask. Proactive suggestions increase the value of the "AI Consultant" role.
- **How it works**: A background worker analyzes sales patterns and populates a "Recommendations" feed without user intervention.

### 4. Rugged High-Performance UI (Vim-Style & Market Mode)
- **What it does**: A keyboard-first interaction model and a high-contrast "Market Mode."
- **Why it's important**: Increases speed in high-traffic retail and ensures visibility in poor lighting conditions.
- **How it works**: Global hotkey listeners for core POS actions and a CSS-variable-based theme switch for high contrast.

# User Experience  

### User Personas
- **The High-Speed Teller (Worker)**: Needs to process 10 customers in 5 minutes using only the keyboard.
- **The Remote Multi-Store Owner (Master)**: Needs to see "Sync Health" and receive "Proactive Insights" on their phone while away from the shop.

### Key User Flows
- **The "No-Mouse" Sale**: Worker hits `/`, types "Para", hits `Enter`, types `5`, hits `+`, hits `Enter` to finalize.
- **The "Insight" Notification**: Owner receives a push notification: "Sales pattern detected: Restock [Product X] by Friday."

### UI/UX Considerations
- **Ambient Connectivity HUD**: A visual progress bar for background sync instead of a static icon.
- **Thin-Client Rendering**: UI components are designed to be "stateless" representations of the SQLite database to keep RAM usage low.
</context>

<PRD>
# Technical Architecture  

### System Components
- **Tauri v2 Sidecar**: Hosts the Node.js LocalBridge, isolated from the UI memory space.
- **SQLite FTS5 Engine**: The primary engine for all searching/filtering.
- **Web Worker Layer**: Handles heavy arithmetic (taxes, margins) to keep the UI thread free for rendering.

### Data Models
- **Mutation Journal**: `id, entity_type, entity_id, change_data (JSON), applied_at, sync_status`.
- **FTS5 Virtual Table**: `product_search` mirroring `products` for sub-millisecond searching.

### APIs and Integrations
- **LocalBridge Streaming API**: Fastify-based stream to send windowed data to the frontend.
- **Supabase Delta Endpoint**: Custom RPCs for atomic inventory updates.

# Development Roadmap  

### Phase 1: Core Performance (The Thin Client)
- **FTS5 Integration**: Migrate product search from `useMasterDataStore` to SQLite.
- **Virtualized Lists**: Implement `TanStack Virtual` for all grids to prevent DOM bloat.
- **Tauri v2 Shell**: Migrate the Electron wrapper to Tauri to save ~300MB-500MB of idle RAM.

### Phase 2: Resilience (The Delta Sync)
- **Mutation Journaling**: Implement the local journal for all Sales/Stock actions.
- **Delta Sync Worker**: Build the background process that pushes deltas to Supabase.
- **Sync Health HUD**: Add the UI indicators for pending mutations.

### Phase 3: Intelligence (The Proactive AI)
- **Insight Generator**: Background logic to process 30-day patterns.
- **Shadow Prompting**: Automatic delivery of insights to the Chat interface.
- **Vim-Style POS**: Implement the keyboard-first workflow.

# Logical Dependency Chain
1. **Infrastructure (Foundation)**: Tauri v2 + SQLite WAL Mode. (Must reduce RAM baseline first).
2. **Data Layer**: FTS5 + Virtualized Search. (Must handle large catalogs without crashing).
3. **Logic Layer**: Delta Sync. (Ensure data integrity before adding features).
4. **UX Layer**: Vim-style POS & AI Insights. (Optimization of the user workflow).

# Risks and Mitigations  
- **Technical Challenge**: Tauri/Node.js sidecar communication overhead.
  - *Mitigation*: Use binary serialization (BSON or Protobuf) if JSON overhead becomes visible.
- **Resource Constraint**: 2.5GB RAM is extremely tight for Windows 10 + App.
  - *Mitigation*: Aggressive tree-shaking and disabling all non-essential background services.
- **MVP Evolution**: Ensuring the "Delta" sync doesn't overcomplicate the initial simple cloud flow.
  - *Mitigation*: Keep the "Cloud Mode" adapter as a fallback for high-bandwidth environments.

# Appendix  
- **Hardware Profile**: Target is specifically the Intel Celeron/Pentium Dual Core era common in emerging markets.
- **Security**: Data on disk should be encrypted using the OS's native encryption (DPAPI for Windows) via the Tauri wrapper.
</PRD>
