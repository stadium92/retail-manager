# PRD-006: LocalBridge Backend Consolidation & Architecture Roadmap

## 1. Executive Summary
The recent removal of the Supabase client SDK from the frontend successfully transitioned the application to a pure "Offline-First" (Local-First) model. However, this transition exposed underlying structural vulnerabilities in the local backend (`local-bridge`) and the frontend's optimistic caching strategy (e.g., phantom products, duplicated items, sales recorded without stock deductions).

This document outlines the strategy to consolidate the local database architecture, ensuring 100% data integrity without immediately rewriting the entire backend in a new language.

## 2. Problem Statement
*   **Phantom Products**: Frontend Optimistic UI adds items to the UI state but fails to sync them to the local SQLite database. Refreshing the page causes these items to disappear.
*   **Unsynced Stock Deductions**: Sales are recorded, but stock quantities are not reliably decremented. The two operations are treated as separate network calls rather than a single atomic transaction.
*   **Duplicate Records**: Lack of strict idempotency allows the frontend to send duplicate `POST` requests if the network stutters, resulting in duplicated entries in the database.

## 3. Phase 1: V1 Consolidation (Immediate Action)
**Goal:** Stabilize the existing TypeScript/Node.js `local-bridge` backend. It is fast, type-safe, and shares interfaces with the frontend. A rewrite is not necessary to fix the current bugs.

### 3.1. Implement ACID Transactions (SQL)
All critical database operations must be wrapped in strict SQL transactions (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK`).
*   **Sales Flow:** Recording a sale MUST atomically include inserting the sale, inserting the sale items, AND updating the product stock (`UPDATE products SET quantity = quantity - X WHERE id = Y`).
*   If any step fails (e.g., a product ID doesn't exist), the entire transaction rolls back, preventing partial data states.

### 3.2. Idempotency via Client-Side UUIDs
*   The frontend must generate the `id` (UUID) for products and sales *before* sending the payload to the backend.
*   The backend will use `INSERT ... ON CONFLICT DO NOTHING` (or `DO UPDATE`) to ensure that if a request is retried, the data is never duplicated.

### 3.3. Rethink Frontend Caching (Optimistic UI)
*   Since the `local-bridge` operates on the local network (sub-millisecond latency), the frontend should rely on the actual SQLite database as the single source of truth.
*   Aggressive IndexedDB caching should be reserved strictly for true offline scenarios (e.g., when `local-bridge` is unreachable), not as a standard buffer that hides DB write failures.

### 3.4. The Outbox Pattern (Cloud Prep)
*   Implement a `sync_outbox` table in SQLite. Every mutation (create, update, delete) writes an event to this outbox.
*   A background worker will sequentially process this outbox to push data to the future Rust Cloud API (Hostinger VPS), ensuring reliable, ordered synchronization even after internet outages.

## 4. Phase 2: V2 Architecture (Future Goal)
**Goal:** Optimize the desktop application by eliminating the Node.js sidecar.

*   Once the system is stable, profitable, and the Rust Cloud API is fully functional, the application will undergo an architectural upgrade.
*   **Native Tauri SQLite:** The `local-bridge` logic (currently running on a local HTTP port 8787 via Node.js) will be rewritten directly into Tauri's Rust core backend.
*   **Benefits:** This will eliminate the need to bundle the Node.js runtime, drastically reducing the application size, significantly improving startup time, and completely eliminating "port already in use" connectivity issues.

## 5. Next Steps
1.  Review the existing TypeScript codebase in `backend/local-bridge/src/` (specifically the routes for `sales` and `products`).
2.  Refactor the database queries to use `better-sqlite3` transactions.
3.  Update frontend service calls to handle idempotent requests.
