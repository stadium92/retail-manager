# Prompt: Implement "Achats" (Purchases) Module
**Context**: We are building a high-density, offline-first Retail Management System. We have completed the Sales/POS module. We now need to build the **"Achats" (Purchases)** section for the Worker Dashboard.

**Objective**: Implement the 4 core sub-modules under the "Achats" menu:
1.  **Réception/Achats** (Goods Receipt)
2.  **Commande AUTOMATIQUE** (Automated Ordering)
3.  **Commande Manuelle** (Manual Ordering)
4.  **Règlements FOURNISSEURS** (Supplier Payments)

## 1. Data Models (Supabase & LocalDB)
Ensure the following tables/schema exist and are synced to IndexedDB (`OfflineSalesService` or similar):
- **`suppliers`**: `id`, `name`, `phone`, `email`, `address`, `balance` (current debt to supplier).
- **`purchase_orders`**: `id`, `supplier_id`, `status` (draft, ordered, received, partial), `total_amount`, `created_at`.
- **`purchase_items`**: `id`, `order_id`, `product_id`, `quantity_ordered`, `quantity_received`, `unit_cost`.
- **`supplier_payments`**: `id`, `supplier_id`, `amount`, `payment_method`, `reference`, `created_at`.

## 2. Module Specifications

### A. Réception/Achats (Goods Receipt)
**Goal**: Receive goods from suppliers and update stock.
- **UI**:
    - **Order Selection**: Dropdown/Search to find an existing "Placed" Purchase Order.
    - **Verification Grid**:
        - Columns: Product Name, Ordered Qty, **Received Qty** (Editable), Cost Price (Editable).
        - Auto-fill "Received Qty" = "Ordered Qty" by default, but allow adjustment.
    - **Ad-Hoc Receipt**: Allow receiving goods *without* a prior order (Direct Purchase).
- **Logic**:
    - On "Validate":
        - Update `products` stock levels (+ Received Qty).
        - Update `products` cost price (Weighted Average Cost or Last Purchase Price).
        - Create a `purchase_order` record (if ad-hoc).
        - Update `suppliers` balance (Credit).

### B. Commande AUTOMATIQUE (Auto-Order)
**Goal**: Generate order suggestions based on low stock.
- **UI**:
    - **Filter**: Supplier (Optional), Category (Optional).
    - **Grid**:
        - Lists all products where `current_stock` <= `min_stock_alert`.
        - Columns: Product, Current Stock, Min Stock, Sales Velocity (Last 30 days), **suggested Qty** (Editable).
        - **Formula**: Suggested Qty = `max_stock` - `current_stock`.
    - **Action**: "Generate Orders" button.
- **Logic**:
    - Groups selected items by **Supplier**.
    - Creates multiple draft `purchase_orders` (one per supplier).

### C. Commande Manuelle (Manual Order)
**Goal**: Manually build an order for a specific supplier.
- **UI**:
    - **Header**: Select Supplier.
    - **Product Picker**: High-density lookup (Barcode/Name) similar to the POS interface.
    - **Cart/Grid**: List of items to order with Quantities and Purchase Prices.
    - **Action**: "Save Order" (Status: Draft or Ordered) or "Send via WhatsApp/Email".

### D. Règlements FOURNISSEURS (Supplier Settlements)
**Goal**: Pay off debts to suppliers.
- **UI**:
    - **Supplier List**: High-level view of all suppliers with non-zero balances.
    - **Payment Modal**:
        - Select Supplier.
        - Enter Amount.
        - Select Method (Cash, Bank Transfer, Cheque).
        - Optional: Link to specific Purchase Orders (Allocation).
- **Logic**:
    - Decreases `suppliers` balance.
    - Records entry in `supplier_payments`.
    - Updates Cash Register (`journal_caisse`) as an "Expense" (Sortie).

## 3. Tech Stack Requirements
- **Frontend**: React + Vite + Shadcn/UI (Tailwind).
- **State**: Zustand (extending `usePOSStore` or creating `usePurchasingStore`).
- **Offline**: Use `idb` (IndexedDB) for all operations. Sync to Supabase in background.
- **Design**: Maintain the "High-Density" aesthetic (Compact rows, keyboard navigation).
- **Language**: **FRENCH** (Français) for all UI labels.

## 4. Deliverables
- New pages in `src/pages/worker/achats/`:
    - `Reception.tsx`
    - `CommandeAuto.tsx`
    - `CommandeManuelle.tsx`
    - `ReglementsFournisseurs.tsx`
- Update `WorkerLayout.tsx` routing to connect these pages.
- Ensure Supabase migrations for new tables are provided if missing.
