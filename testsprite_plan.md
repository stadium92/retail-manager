# Retail Manager Q&A Test Plan

## Authentication Credentials
The following accounts must be used to test role-based access control and module functionality:
- **Master Account:** `ursula@master.com` / `madfaX-1pobwa-synnoj`
- **Manager Account:** `frangin@gmail.com` / `=87654321`
- **Worker Account 1:** `jesse@worker.com` / `ximdu1-sowsyf-Mokkaz`
- **Worker Account 2:** `dilly@worker.com` / `dofwum-qEfnoz-6mexci`

## Test Scenarios

### 1. Role-Based Access Control (RBAC)
- **Action:** Log in with a Worker Account (`jesse@worker.com`).
- **Expected Result:** The user should be routed to the Worker Interface (SalesModule, POS). They MUST NOT have access to global financial reports or master store deletions.
- **Action:** Log out, then log in with the Master Account (`ursula@master.com`).
- **Expected Result:** The user should have full access to the Master Dashboard, Edition/Reporting modules, and team management.

### 2. POS Checkout Flow (SalesModule)
- **Action:** Log in as a worker. Navigate to the Sales screen.
- **Action:** Add a product to the cart. Change the unit from "Piece" to "Box".
- **Expected Result:** The total price must update correctly incorporating the package size multiplier.
- **Action:** Complete the checkout using Cash payment.
- **Expected Result:** The transaction successfully records, cart clears, and an invoice number is generated.

### 3. Invoice Printing Buttons
- **Action:** Navigate to the "Edition" -> "Listes des Factures" (Invoice List).
- **Action:** Click the "Eye" (View) icon on a completed transaction.
- **Expected Result:** A details dialog opens showing two print buttons at the bottom: "Ticket Caisse" and "Facture A4". Both should open the browser's native print screen when clicked.

### 4. Offline Resilience (If supported by testing tool)
- **Action:** Disconnect the network (offline mode).
- **Action:** Perform a sale as a worker.
- **Expected Result:** Sale succeeds and is saved locally.
- **Action:** Reconnect the network.
- **Expected Result:** The sale automatically synchronizes to the server without data loss.
