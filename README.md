# RetailScope Pro 🌍🛒
### The Enterprise-Grade, Offline-First Retail Operating System for Emerging Markets.

![Status](https://img.shields.io/badge/Status-Production_Ready-success)
![Architecture](https://img.shields.io/badge/Architecture-Rust_%2B_Node.js_Sidecar-orange)
![Stack](https://img.shields.io/badge/Frontend-React_%2B_Tauri-blue)
![Connectivity](https://img.shields.io/badge/Connectivity-100%25_Offline_Capable-darkgreen)

---

## 🚀 The Proposition
**RetailScope Pro** is not a generic SaaS. It is a specialized, military-grade POS and Inventory Management system engineered specifically for the harsh constraints of emerging markets (West Africa, SE Asia).

It solves two critical problems that break standard cloud software:
1.  **Zero Connectivity:** Retailers in Mali or Ghana cannot rely on 24/7 internet. RetailScope Pro runs **100% locally** on low-end hardware (Intel Dual Core, 4GB RAM) with zero latency.
2.  **Revenue Protection (Anti-Theft):** In markets where "shrinkage" (employee theft) can eat 20% of revenue, RetailScope enforces strict, blind closeouts, immutable audit logs, and role-based access control (RBAC) to secure every franc.

**Current Status:** Actively deployed and generating revenue in **Mali (Francophone)** and **Ghana (Anglophone)**.

---

## 🏗️ Technical Architecture: The "Sidecar" Engine

This project demonstrates a sophisticated **Hybrid Desktop Architecture** that combines the safety of Rust with the agility of the JavaScript ecosystem.

```mermaid
graph TD
    A[Desktop Shell (Tauri/Rust)] -->|Manages| B[Sidecar Process (Node.js Binary)]
    B -->|Fastify API| C[Local Database (SQLite)]
    A -->|WebView| D[React Frontend]
    D -->|HTTP/REST| B
    B -->|Sync Outbox| E[Cloud (Supabase) - Optional]
```

### 1. The Rust Sidecar Wrapper 🦀
Unlike Electron apps that bloat, we use **Tauri**. The backend is a self-contained **Node.js executable** wrapped in a custom Rust binary.
*   **Zero Dependencies:** The user does not need to install Node, Python, or SQL. They just click the `.exe` or `.msi`.
*   **Self-Healing:** The Rust parent process monitors the Node sidecar and restarts it instantly if it fails.

### 2. Synchronous SQLite Bridge ⚡
We use `better-sqlite3` in WAL (Write-Ahead Log) mode for synchronous, blazing-fast transactions.
*   **Transactions:** Complex sales with stock deductions and ledger updates happen atomically.
*   **FTS5 Search:** Full-Text Search is built into the DB layer for instant product lookups on 10,000+ SKU catalogs without external search engines.

### 3. "Hub & Spoke" Hybrid Sync 🔄
We implemented a robust **Offline-First Sync Architecture** inspired by linear logs.
*   **The Outbox:** Every mutation (Create Sale, Delete Product) is written to a `sync_outbox` table in SQLite.
*   **Eventual Consistency:** When the owner connects a mobile hotspot, the system pushes the outbox to the Cloud (Supabase) and pulls down updates.
*   **Idempotency:** Transactions use UUIDs and idempotency keys to ensure network flutters never cause double-billing.

---

## 🛡️ Key Features

### 🛒 Point of Sale (POS)
*   **Multi-Mode Engine:** Instantly switch between **Retail (Détail)**, **Wholesale (Gros)**, and **Proforma Invoice**.
*   **Piece-Centric Pricing:** Smart unit conversion allows selling single items or full cartons without "price jump" math errors.
*   **Keyboard First:** Full F1-F12 shortcuts for mouse-free operation in high-volume environments.

### 🔒 Revenue Protection
*   **Blind Closeout:** Cashiers count cash *before* seeing the system expected total.
*   **Immutable Logs:** Every action (even a deleted line item) is recorded in the `audit_logs` table with user ID and timestamp.
*   **Strict Roles:** "Worker" accounts are store-bound and cannot see cost prices or delete master files.

### 🌍 Hyper-Localization
*   **True Polyglot:** Seamless switching between **English**, **French**, and **Bambara**.
*   **Currency Agnostic:** Built-in support for **XOF (CFA)**, **GHS (Cedis)**, **EUR**, and **USD** with dynamic formatting.

---

## 💼 Why Acquire/License This Codebase?

This is a "Business in a Box" for IT Agencies in emerging markets.

1.  **White-Label Ready:** The code is cleanly structured (`useSettingsStore`) to allow easy rebranding (Logo, Colors, Name) for resale to local shops.
2.  **Hardware Agnostic:** Optimized for Windows 10/11 on refurbished hardware. No need for expensive Mac/Cloud servers.
3.  **Documentation:** Includes a sophisticated "Memory Bank" (`/memory-bank`) folder containing strict architectural rules, PRDs, and context files, making it easy for AI agents (Copilot, Cursor) to maintain the code indefinitely.

---

### 🛠️ Development Setup

**Prerequisites:**
- Node.js 18+
- Rust (Cargo)
- Python 3.10+ (for build scripts)

**Start Dev Environment:**
```bash
# 1. Install dependencies
npm install
cd backend/local-bridge && npm install

# 2. Run the full stack (Frontend + Sidecar)
npm run tauri dev
```

**Build for Production (Windows):**
```bash
# Uses custom Rust wrapper to embed Node.js
npm run build:sidecar:win
npm run tauri build --target x86_64-pc-windows-msvc
```

---

*Copyright © 2026 RetailScope Pro. Built with ❤️ for the Global South.*
