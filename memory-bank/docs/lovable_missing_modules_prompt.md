# Prompt: Implement Missing Sub-Modules

**Context**: Most modules are built, but 3 specific sub-modules are missing implementation or logic.

**Objective**: Implement the missing logic for "Régularisation du Stock", "Achats par Famille", and "Règlements des Bons".

## 1. Stock Section: "Régularisation du Stock"
**File**: `src/components/worker/Modules/StockModule.tsx`
**Action**: Add a new case `regularisation-stock` to the `renderContent` switch.
**Features**:
- **UI**: A form to manually adjust stock for a specific product.
- **Inputs**: 
    - Search Product (Select).
    - Adjustment Type (Radio: "Addition" / "Subtraction").
    - Quantity (Number).
    - Reason (Text: e.g., "Found", "Gift", "Correction").
- **Logic**:
    - On submit, update `products` table (increment/decrement quantity).
    - Create a record in `stock_movements` table (if it exists) or log it.

## 2. Edition Section: "Achats Famille/produits"
**File**: `src/components/worker/Modules/EditionModule.tsx`
**Action**: Add a new case `suivi-achats-famille` to the `renderContent` switch.
**Features**:
- **UI**: A aggregated report of purchases grouped by Product Family.
- **Logic**:
    - Fetch purchase items (join with products -> families).
    - **Grouping**: Group by `family_name`.
    - **Columns**: Family Name, Total Quantity Purchased, Total Amount.
    - **Filters**: Date Range (reuse existing date picker).

## 3. Ventes Section: "Règlements des Bons"
**New File**: `src/components/worker/Modules/ReglementsBonsModule.tsx`
**Action**: Create this new module.
**Context**: "Bons" refers to IOUs or Credits given to customers. This module tracks their repayment.
**Features**:
- **UI**: List of unpaid "Sales on Credit" (where `payment_status` = 'pending' or 'partial').
- **Table Columns**: Date, Customer Name, Invoice #, Total Amount, **Remaining Balance**, Actions.
- **Action**: "Régler" (Settle) button.
    - Opens a modal/dialog to enter payment amount.
    - Updates the sale's `payment_status` and `amount_paid`.

## 4. Wiring
- Update **`WorkerLayout.tsx`**:
    - Import `ReglementsBonsModule`.
    - Map `case 'reglements-bons'` to `<ReglementsBonsModule storeId={storeId} />`.
