# PRD-004: Smart Replenishment Hub ("Produits à Commander")

## 1. Executive Summary
The "Produits à Commander" feature is a centralized decision-making hub for inventory replenishment. Instead of relying solely on reactive "Low Stock" alerts, this module aggregates multiple demand signals (System Alerts, Worker Requests, AI Predictions) into a single, actionable interface for the Master/Store Manager to generate Purchase Orders efficiently.

## 2. Problem Statement
*   **Reactive vs. Proactive:** Currently, orders are triggered only when stock hits a hard minimum (`min_quantity`). This leads to stockouts if lead times are long.
*   **Missed Signals:** Workers often notice trends or customer requests ("Do you have X?") that the system doesn't know. There is no formal channel to log these.
*   **Fragmentation:** "Low Stock" lists are separate from "Purchase Orders". The user has to mentally bridge the gap.

## 3. Solution Overview
A new view **"Achats > À Commander"** (Purchasing > To Order) that acts as a staging area for purchase orders.

### Core Features:
1.  **Unified Demand List:** Aggregates items from:
    *   🔴 **Critical Low Stock:** `Quantity <= Min_Quantity`
    *   🟡 **Projected Stockout:** AI prediction based on sales velocity (e.g., "Empty in 3 days").
    *   🔵 **Worker Requests:** Manual flags from the POS (e.g., "Customer asked for this").
2.  **Smart Grouping:** Automatically groups items by **Primary Supplier**.
3.  **One-Click Ordering:** "Generate Draft Order" button for a specific supplier.

## 4. User Experience (UX)

### 4.1 Master Dashboard Location
*   **Module:** `Achats` (Purchases)
*   **Tab/Submodule:** `Besoins & Alertes` (Needs & Alerts) or `Produits à Commander`.

### 4.2 UI Mockup Description
*   **Header:** Filters (By Supplier, By Urgency, By Category).
*   **Main Table:**
    *   **Product:** Name + SKU + Image.
    *   **Stock Status:** Current Stock / Min Stock.
    *   **Signal Source:** Badge (🔴 Low Stock, 🔵 Request, ✨ AI Prediction).
    *   **Suggestion:** Recommended Quantity (Editable).
    *   **Action:** Checkbox to select.
*   **Floating Action Bar:** "Create Order for [Supplier Name] ([N] Items)".

### 4.3 Worker Interaction (New)
*   In `Fiche Stock` or `Listing`, add a **"Signaler Besoin"** (Flag Need) button.
*   Worker selects urgency (High/Normal) and adds a note (e.g., "Client request").

## 5. Technical Architecture

### 5.1 Database Schema Updates
We need a table to track *manual* requests to distinguish them from auto-calculated low stock.

```sql
CREATE TABLE replenishment_requests (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  requested_by TEXT, -- Worker ID
  quantity_requested INTEGER,
  reason TEXT, -- "Customer Request", "Damaged", etc.
  status TEXT DEFAULT 'pending', -- pending, ordered, rejected
  created_at TEXT NOT NULL
);
```

### 5.2 Business Logic (LocalBridge)
*   **Aggregation Endpoint:** `/rest/v1/purchasing/needs`
    *   Fetches `products` where `quantity <= min_quantity`.
    *   Fetches `pending` records from `replenishment_requests`.
    *   (Future) Fetches AI predictions.
    *   Merges duplicate products (e.g., Low Stock + Worker Request -> Show both signals, max quantity).

## 6. Implementation Plan
1.  **Phase 1 (Foundation):** Build the "Low Stock" aggregator in Master > Achats.
2.  **Phase 2 (Worker Input):** Add "Request Stock" button in Worker views.
3.  **Phase 3 (Automation):** "One-Click PO Generation" grouping by supplier.

## 7. Success Metrics
*   Reduction in "Out of Stock" incidents.
*   Time saved creating Purchase Orders (Target: < 2 minutes).