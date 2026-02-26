# Sanifere Feature Analysis (Screen-by-Screen)

Detailed breakdown of the Sanifere POS system based on various module screenshots.

## 1. Login & Dashboard
- **Screenshot**: `WhatsApp Image 2026-01-20 at 17.41.19 (2).jpeg`
- **Description**: Classic login screen with username and password fields in a blue modal over a yellow background.
- **Key Features**: Simple authentication, branding placement.

## 2. Invoicing (Vente au DETAIL / GROS)
- **Screenshots**: `WhatsApp Image 2026-01-20 at 17.41.22.jpeg`, `WhatsApp Image 2026-01-20 at 17.41.27.jpeg`
- **UI Structure**:
    - Header: Invoice #, Date, Client Code/Name, Order Ref.
    - Grid: Designation (large), Code, Unit Type, Current Stock (real-time visibility during entry), Price, Qty, Discount %, Total.
    - Bottom Toolbar: Function key shortcuts (F1 Aide, F2 Valide, F3 Selectionne, F4 Reglement, F5 Fiche, F6 Imprime, F10 Ticket, F11 Prix).
- **Core Logic**: Row-level validation, automatic stock deduction, discount handling.

## 3. Product Management (Fiche Produit)
- **Screenshot**: `WhatsApp Image 2026-01-20 at 17.40.42.jpeg`
- **Fields Observed**:
    - `Designation`: Full product name.
    - `Ref`: Internal reference code.
    - `Prix Vente`: Multi-level pricing (Selling Price #1, #2, #3, #4).
    - `Code Barre`: Support for SKU/EAN scan.
    - `CDNT`: Packing/Units (e.g., 1 UNITE).
    - `Marque`: Brand association.
    - `Rayon/Categorie/Famille`: 3-level hierarchy for organization.
    - `Date Peremption`: Expiry date tracking.
    - `Prix Achat`: Purchase price for margin calculations.
    - `Stock Mini/Actuel`: Automated alerts when reaching thresholds.
    - `Dernieres Dates`: Tracking last Inventory, Purchase, and Sale dates directly on the card.
    - `Meilleurs Fournisseurs`: Integrated view of top suppliers for this specific product.

## 4. Cash Management (Fiche Caisse)
- **Screenshot**: `WhatsApp Image 2026-01-20 at 17.41.12.jpeg`
- **Functionality**:
    - **Billetage**: Manual count of cash by denomination (XAF/CFA) - 10k, 5k, 2k, 1k, 500, Coins.
    - **Transactions du Jour**: Summary of Cash Sales, Cheques, Credit Payments/Sales, Supplier Payments, and Daily Expenses.
    - **Reconciliation**: Automated total vs. physical count.
    - **Transfers**: "Versement Siege" and "Versement Banque" tracking.

## 5. Stock & Inventory Control
- **Screenshots**: `WhatsApp Image 2026-01-20 at 17.41.13.jpeg`, `WhatsApp Image 2026-01-20 at 17.41.16.jpeg`
- **Features**:
    - **Dual Locations**: Distinguishes between "Surface" stock and "Magasin" stock.
    - **Listings**: Dedicated views for Expiring products, Products in "Rupture" (out of stock), and Price Catalogs.
    - **Inventory Saisie**: High-speed entry screens for physical counts.

## 6. Purchasing & Supplier Management
- **Screenshot**: `WhatsApp Image 2026-01-20 at 17.41.26 (1).jpeg`
- **Functionality**:
    - **Supplie Orders**: View of "Produits a Commander" with current stock vs. suggested order quantities.
    - **Supplier Règlements**: Tracking payments against supplier accounts over specific date ranges.
