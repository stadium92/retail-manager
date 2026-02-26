# Prompt: Implement "Fichiers" (Master Data) Module
**Context**: We are building the **"Fichiers" (Master Data)** section of the Retail Management System. This module is the backbone of the application, managing all static entities (Products, Clients, Suppliers, Families).

**Objective**: Implement the following sub-modules under the "Fichiers" menu:
1.  **Produits/Articles** (Product Management)
2.  **Clients** (Customer Management)
3.  **Services-CLIENTS** (Customer Services/Groups)
4.  **Fournisseurs** (Supplier Management)
5.  **Familles-PRODUITS** (Product Families/Categories)

## 1. Data Models (Supabase & LocalDB)
Ensure schemas support the following rich data sets. Sync with IndexedDB is mandatory.

- **`products`** (Enhanced):
    - `id`, `name`, `sku` (reference), `barcode`, `description`.
    - **Pricing**: `purchase_price`, `selling_price_detail`, `selling_price_wholesale`, `selling_price_3`, `selling_price_4`.
    - **Stock**: `min_stock_alert`, `current_stock` (calculated), `unit_type` (e.g., Piece, Kg).
    - **Classification**: `family_id` (FK), `brand`.
    - **Dates**: `expiry_date`, `last_sale_date`, `last_inventory_date`, `last_purchase_date`.
    - **Relations**: `preferred_supplier_id` (FK).

- **`clients`**:
    - `id`, `name`, `code` (internal ID), `phone`, `email`, `address`.
    - **Financial**: `credit_limit`, `current_balance`, `loyalty_points`.
    - **Group**: `service_id` (FK - for Services-CLIENTS grouping).

- **`suppliers`** (As defined in Achats, but enhanced):
    - `id`, `name`, `contact_person`, `phone`, `email`, `address`, `lead_time_days`.

- **`product_families`**:
    - `id`, `name`, `parent_id` (for hierarchy), `description`.

- **`client_services`** (Services-CLIENTS):
    - `id`, `name` (e.g., "VIP", "Wholesale", "Public Administration"), `default_discount_percent`.

## 2. Module Specifications

### A. Produits/Articles (Product Master)
**Goal**: A central hub for creating, editing, and analyzing individual products.
- **UI Layout**:
    - **List View**: High-density grid with search/filter by Family, Brand, or SKU.
    - **Detail View (Tabbed Modal)**:
        - **General**: Name, SKU, Barcode, Family, Unit.
        - **Pricing**: Grid showing Cost vs. 4 Selling Prices + Margin calculation.
        - **Stock & Dates**: Min Stock, Expiry Date, Last Inventory.
        - **Suppliers**: Link preferred suppliers.
- **Micro-Features**:
    - **Visual Barcode Gen**: Auto-generate a barcode string if missing.
    - **History**: Quick view of last 5 movements (entries/exits) for this product.

### B. Clients (Customer Master)
**Goal**: Manage customer profiles and credit limits.
- **UI**:
    - **Grid**: Name, Phone, Balance, Credit Limit.
    - **Form**:
        - Basic Info (Name, Contact).
        - **Financial Controls**: Set Max Credit Limit (block sales if exceeded).
        - **Group**: Assign to a "Service" (e.g., VIP).

### C. Services-CLIENTS
**Goal**: Group customers for reporting or policy application.
- **UI**:
    - Simple CRUD for creating Customer Groups (e.g., "Corporate", "Retail", "Government").
    - Allow setting a **Global Discount** for a group (applied automatically at POS).

### D. Fournisseurs (Supplier Master)
**Goal**: Manage supplier relationships.
- **UI**:
    - **Grid**: Supplier Name, Contact, Balance Due.
    - **Form**: Address, Payment Terms, Lead Time.
    - **Purchase History**: Tab showing last 10 orders from this supplier.

### E. Familles-PRODUITS
**Goal**: Hierarchical categorization of products.
- **UI**:
    - Tree view or Nested List of families.
    - Ability to add Sub-families.
    - Assign default tax rates or margin targets to a family (optional advanced feature).

## 3. Tech Stack Requirements
- **Frontend**: React + Vite + Shadcn/UI (Tailwind).
- **State**: `useMasterDataStore` (Zustand) for caching these entities locally.
- **Offline**: CRUD operations must work offline (queued in `OfflineService`) and sync when online.
- **Navigation**: Update `WorkerLayout.tsx` to link to:
    - `src/pages/worker/files/Products.tsx`
    - `src/pages/worker/files/Clients.tsx`
    - `src/pages/worker/files/Suppliers.tsx` (Reuse/Enhance if started in Achats)
    - `src/pages/worker/files/Families.tsx`
- **Language**: **FRENCH** (Français) for all UI labels.

## 4. Deliverables
- Implementation of the above 5 modules.
- Integration with the existing `LocalDatabase` Service.
- High-density table components with sorting and filtering.
