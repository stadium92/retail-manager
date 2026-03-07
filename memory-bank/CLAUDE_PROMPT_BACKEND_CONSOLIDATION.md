# Prompt for Claude 3.7 / 3.5 Sonnet to Consolidate the LocalBridge Backend

**Context:**
We have successfully stripped out the Supabase client SDK from the frontend, transitioning the application to a pure "Offline-First" model. The frontend now communicates exclusively with our local backend (`backend/local-bridge`) via an HTTP API on port 8787.

However, this transition exposed some critical flaws in the backend's current architecture that were previously masked or compensated for by the cloud. 
Specifically, we are facing:
1. **Unsynced Stock Deductions:** Sales are recorded, but the product stock (`quantity`) is not decremented reliably. The API handles the sale creation and stock updates as separate, non-atomic operations.
2. **Duplicate Records:** Due to network stutters and optimistic UI retries, the frontend sometimes sends the same `POST` request multiple times, leading to duplicate sales or products in the database.
3. **Phantom Data (Frontend):** The frontend relies heavily on its own memory (Zustand/IndexedDB) rather than trusting the local database as the absolute source of truth.

**Your Task:**
As a Senior Backend Engineer specializing in TypeScript, Node.js, and SQLite (`better-sqlite3`), your task is to refactor the `backend/local-bridge` codebase to ensure 100% data integrity using strict ACID transactions and idempotency.

**Constraints & Guidelines:**
- **DO NOT** rewrite the backend in another language (e.g., Rust). Keep it in TypeScript. We want to leverage the existing code and shared types.
- **DO NOT** change the API endpoints or the request/response payloads if possible. The goal is internal stabilization, not a breaking API change.
- **Focus on the Database Layer:** The primary focus should be on the `backend/local-bridge/src/db/` directory, specifically the repository files handling `sales` and `products`.

**Required Implementation Steps:**

1. **Implement ACID SQL Transactions (`better-sqlite3`):**
   - Refactor the `createSale` (or equivalent) logic. It MUST be a single, atomic transaction using `db.transaction()`.
   - The transaction must execute:
     1. `INSERT` into the `sales` table.
     2. `INSERT` into the `sale_items` table for each product.
     3. `UPDATE products SET quantity = quantity - ? WHERE id = ?` for each product.
   - If *any* step fails (e.g., insufficient stock, invalid product ID), the entire transaction MUST `ROLLBACK`.

2. **Implement Idempotency (ON CONFLICT DO NOTHING):**
   - The frontend is already capable of generating UUIDs (`id`) before sending the payload.
   - Update your `INSERT` queries for `products` and `sales` to handle conflicts gracefully.
   - Example: `INSERT INTO products (id, name, ...) VALUES (?, ?, ...) ON CONFLICT(id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;` (or simply `DO NOTHING` depending on the logic). This ensures that retried requests do not create duplicate rows.

3. **Audit and Clean Up:**
   - Briefly review the `products.repo.ts` and `sales.repo.ts` files to ensure all mutations (Create, Update, Delete) are robust and handle potential errors cleanly.
   - Ensure that the backend always returns the *actual* state of the database after a mutation, so the frontend can safely replace its optimistic state.

Please provide the updated code for the relevant repository files (e.g., `sales.repo.ts`, `products.repo.ts`) and briefly explain the changes you made to ensure atomicity and idempotency.
