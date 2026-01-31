# Retail Manager Tasks

## 🚀 DeepSearch Planning Audit Implementation
- [ ] Implement Framework Migration (Electron -> Tauri v2)
  - [ ] Bundle Node.js LocalBridge as a Sidecar in Tauri
  - [ ] Optimize for Low-End Hardware (Dual Core / 2.5GB RAM)
- [ ] Eliminate In-Memory State Bloat
  - [ ] Refactor `useMasterDataStore` (Zustand) to Virtualized + SQLite Pagination approach
  - [ ] Implement direct React to LocalDatabase async queries pattern
- [ ] Backend Logic Centralization
  - [ ] Move Underlying Calculations (Prices, Taxes, Daily Totals) to LocalBridge
  - [ ] Implement robust synchronization strategy for Sales data with conflict handling
- [ ] Security Audit Implementation
  - [ ] Secure local SQLite data against physical theft
  - [ ] Lock down LocalBridge API to ONLY Tauri localhost

## 🏗️ Offline + Hybrid Refactor Phase 1: Offline MVP (Remaining)
- [ ] P1.3: Mirror Supabase `products`/`product_families` schema in Drizzle models
- [ ] Finalize frontend store loading hooks for all modules

## 🏗️ Offline + Hybrid Refactor Phase 3: Reliability & Packaging
- [ ] P3.1: Create Windows Service wrapper (node-windows) to host LocalBridge
- [ ] P3.2: Add macOS LaunchAgent plist for auto-start
- [ ] P3.3: Build `/health/full` endpoint returning DB status, queue depth, last sync timestamp
- [ ] P3.4: Surface this data in a Diagnostics screen within the app
- [ ] P3.5: Implement log bundle export (zip backend logs + SQLite DB copy)
- [ ] P3.6: Optional remote command channel (polling Supabase for config updates)

## 🤖 AI Integration (Phase 3)
- [ ] Ensure one month (30 days) of data collection capability
- [ ] Implement Edge AI infrastructure for local processing
- [ ] Build Conversational AI Interface (ChatGPT-like)
- [ ] Implement Dual Analysis Engine (Sales patterns + Inventory items)

## 📊 Advanced Features (Phase 4)
- [ ] Implement Weighted Average Calculations for worker performance
- [ ] Build Sales Status System (Good/Bad/Worse) with automated indicators
- [ ] Finalize Store Interconnection features and shared insights
