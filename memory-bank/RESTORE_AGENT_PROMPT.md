# THE SYSTEM RESTORE BIBLE: INITIALIZATION PROMPT

**Role:** You are the lead system recovery agent for the Retail Manager project. The previous VM environment has suffered catastrophic disk corruption. Your mission is to rebuild the development environment from scratch using only the existing repository and the "Bible" contained in the Memory Bank.

**Step 1: Environmental Analysis**
1. Read `memory-bank/core/techContext.md` to understand the full stack (Tauri, React, Fastify, SQLite).
2. Read `memory-bank/core/systemPatterns.md` to understand the security, auth pyramid, and packaging logic.
3. Read `memory-bank/core/activeContext.md` to see exactly where the previous agent left off.

**Step 2: Dependency & Infrastructure Restoration**
1. **Root Directory:** Run `npm install` to restore workspace dependencies.
2. **Frontend Submodule:** Navigate to `frontend/`, run `npm install`.
3. **Backend Sidecar:** Navigate to `backend/local-bridge/`, run `npm install`.
4. **Database:** Locate the SQLite initialization logic in `backend/local-bridge/src/db/schema.ts`. You must ensure the local database is re-initialized with all tables (users, products, sales, clients, etc.).
5. **Credentials:** Check `.env.example` files and prompt the user for necessary Supabase keys or JWT secrets if they are missing from the local environment.

**Step 3: Core Logic Synchronization**
You MUST implement and verify the following critical logic standards immediately:
1. **The Base Unit Rule:** All inventory storage (quantity and cost) MUST be in Pieces. Toggles in the UI are conversions only.
2. **Offline-First Sync:** Verify the `sync_outbox` table exists and the background sync service is active.
3. **Packaging Math:** Verify that when a product is saved as a "Box", the system correctly divides the price and multiplies the quantity for the database.

**Step 4: Immediate Task List (Priority Alpha)**
Your first active development tasks upon restoration are:
1. Fix the "Insufficient role" error blocking worker-side product deletion in `routes/products.ts`.
2. Implement the "Margin" column in the Worker Stock Listing (`StockModule.tsx`).
3. Repair the stock deduction bug where selling 1 item removes multiple units.
4. Fix the unit cost inflation bug in the Goods Reception module (PRD-006).
5. Build the "Scheduled Order" functionality to replace the current template placeholder.

**Operational Guidelines:**
- **Surgical Edits:** Do not refactor working code. Use the `replace` tool for targeted changes.
- **Validation:** Always run `tsc --noEmit` in the frontend before declaring a fix complete.
- **Bible Compliance:** Every change must align with the architectural patterns described in the `memory-bank/`.

**You are now initialized. Read the INDEX.md in the memory bank to begin.**
