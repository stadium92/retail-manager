# PRD-006: Packaging Logic, Stock Deduction & UI Enhancements

## 1. Executive Summary
This PRD addresses critical logic failures regarding packaging (Box vs. Piece), incorrect stock deduction during sales, and missing data links in the Cash Closing module. It also adds requested visibility features to the Stock Listing.

## 2. Core Logic Standard: "The Base Unit Rule"
**Crucial:** All quantities and prices stored in the Database MUST be in **Base Units (Pieces)**. The UI is a conversion layer only.

### 2.1 Product Creation/Editing Logic
- **When "Piece" is selected:** Values are saved as entered.
- **When "Box" is selected:**
    - **Quantity:** Input value must be multiplied by `packaging` before saving. (e.g., 10 Boxes of 12 = 120 Pieces).
    - **Prices (Buying, Wholesale, Detail, Resale):** Input values must be divided by `packaging` before saving. (e.g., Box Price 1200 / 12 = 100 Piece Price).
- **UI Toggle:** Toggling between Piece/Box in the form should dynamically scale the displayed numbers so the "Total Value" remains constant.

## 3. Bug Fixes

### 3.1 Goods Reception (Castel Bug)
- **Problem:** Unit cost inflation (e.g., 416 -> 9999) during reception.
- **Root Cause:** Double multiplication. The frontend likely sends a Box Price which the backend treats as a Piece Price and multiplies by packaging again.
- **Fix:** Ensure the payload sent to `purchasing/receive` or `purchase_items` is ALWAYS the **calculated Piece Price**.

### 3.2 Incorrect Stock Deduction (Voody/Castel Bug)
- **Problem:** Selling 1 unit deducts 2 or 3 from stock.
- **Fix:** Audit `SalesModule.tsx` and the backend `POST /rest/v1/sales` route.
    - Verify that `quantity` in `sale_items` reflects the unit type.
    - Ensure the deduction logic is exactly: `UPDATE products SET quantity = quantity - sold_qty`.
    - Prevent race conditions or double-firing of triggers.

### 3.3 Cash Closing Module
- **Problem:** Sales are not appearing in the Daily Transaction table.
- **Fix:** Update the `CashClosing` component to query the `sales` table for the current date. The "Cash of the Day" must be a `SUM(total_price)` of all sales where `payment_method = 'cash'` and `created_at` is today.

## 4. Feature Enhancements

### 4.1 Stock Listing (Worker Side)
- **Task:** Add a "Margin" column to the far right of the table in `StockModule.tsx`.
- **Calculation:** `((Selling Price - Buying Price) / Buying Price) * 100`.

### 4.2 Automatic Order (Scheduled Orders)
- **Task:** Replace the "Template" placeholder with a functional form.
- **Fields:** Product Selection (Search), Quantity, Recurrence (Daily/Weekly/Monthly).
- **Persistence:** Save to the `scheduled_orders` table.

## 5. Performance
- **Optimization:** Implement local caching for the Product FTS (Full Text Search) index.
- **Networking:** Reduce redundant re-fetches in `useEffect` hooks by using the `useMasterDataStore` more effectively.
