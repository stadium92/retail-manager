# Prompt: Implement Admin & Reporting Modules (Edition, Gestion, Stock, Programme)
**Context**: We need to complete the remaining Worker/Master modules to match the reference Sanifere ERP system. These modules are currently placeholders.

**Objective**: Implement the following 4 sections. Use `Recharts` for all charts and `TanStack Table` (Shadcn UI Table) for all grids.

## 1. Edition (Reporting)
**Goal**: View-only reports and history.
- **Situation CLIENT**: Search Client -> View Balance & Transaction History.
- **Suivi des VENTES**:
    - *Ventes du jour*: Sales made today (Grid: Time, Product, Qty, Total).
    - *Ventes par produit*: Aggregate sales by product for a date range.
    - *Liste des factures*: Re-print or view details of past invoices.
- **Situation FOURNISSEUR**: Search Supplier -> View Debt & Payment History.
- **Suivi des ACHATS**:
    - *Achats du jour*: Goods received today.
    - *Achats période*: Purchases by supplier over time.

## 2. Gestion (Management)
**Goal**: Financial control and business intelligence.
- **Consultation/Journal CAISSE**:
    - Table showing all cash entries (Orders) and exits (Expenses, Supplier Payments).
    - Calculate "Net Cash in Drawer".
- **Tableau de bord (Dashboard)**:
    - **KPI Cards**: Daily Revenue, Total Profit, # Orders, Low Stock Items.
    - **Charts**: 
        - Bar Chart: Revenue last 7 days.
        - Pie Chart: Top 5 Categories.
- **Statistiques**: Detailed breakdown of Top Selling Products.
- **SORTIE des PERTES**:
    - Form to record damaged/expired goods.
    - Inputs: Product, Qty, Reason (e.g., "Expired", "Broken").
    - Action: Deduct from stock, log as "Loss".

## 3. Stock (Inventory Control)
**Goal**: Advanced stock management beyond simple product list.
- **Fiche de Stock**: Detailed view of a single product's movement history (Entries, Sales, Returns, Losses).
- **Mouvements du Stock**: Global log of all stock changes (audit trail).
- **Listing du STOCK**:
    - Report showing current stock value (Qty * Cost Price).
    - Filters: "In Stock", "Out of Stock", "Expired".
- **Inventaire du STOCK**:
    - Mode for physical counting.
    - Grid: Product Name, System Stock, **Physical Stock** (Editable).
    - Action: "Valider Inventaire" (Adjusts system stock to match physical).

## 4. Programme (Settings)
**Goal**: Configuration.
- **Préférences**: Toggle Dark/Light mode (already exists, just UI), Printer Settings (A4 vs Ticket).
- **Programmation TOUCHE**: (Optional) UI to remap F-Keys (F1-F12).
- **Mots de passe**: Change current user password.

## 5. Technical Requirements
- **Mock Data**: For charts/reports, if real data isn't enough, generate realistic mock data to demonstrate the UI.
- **Components**: Reuse `WorkerLayout` structure. Create a new module file for each major section (e.g., `EditionModule.tsx`, `GestionModule.tsx`).
- **Icons**: Use `Lucide-React`.
- **Theme**: Stick to the "Cyberpunk Enterprise" aesthetic (High contrast, density).

## 6. Deliverables
- `EditionModule.tsx` (handling all 'Edition' routes).
- `GestionModule.tsx` (handling all 'Gestion' routes).
- `StockModule.tsx` (handling all 'Stock' routes).
- `SettingsModule.tsx` (handling all 'Programme' routes).
- Update `WorkerLayout` to render these modules instead of `PlaceholderModule`.
