# UI/UX Improvements & Refactoring Prompt

**Context**: This document defines the requirements for a series of UI/UX improvements and logic refactors for the Retail Manager application (specifically the "Vente"/Sales modules).

**Target Audience**: AI Agents (Lovable/Cursor) or Developers.

## 1. Objective
Enhance the stability, interactivity, and business logic of the Sales interface to match "top-grade applications". Key focus areas include state persistence, dynamic reference numbering, bi-directional data binding for customers, and a fully interactive, resizable grid system.

## 2. Global UI Refactors

### 2.1 Resizable Grid Tables
**Target**: `src/components/worker/Sales/SanifereGrid.tsx` (and similar grid components).
**Requirement**:
- The user must be able to click and drag the borders between column headers to resize them.
- **Specific Header**: `S | DÉSIGNATION | CODE | Cndt | STOCK | PVG | Qté | %Rem. | MONTANT`.
- **Behavior**:
  - Cursor changes to `col-resize` on hover over borders.
  - Dragging updates the width of the column in real-time.
  - The "spaces" (padding/margins) should also be adjustable if implied by "modify spaces".
- **Scope**: Apply this pattern to all similar data grids in the project, not just the Sales module.

### 2.2 Function Keys Bar (Footer)
**Target**: `src/components/worker/Sales/SanifereFooter.tsx`.
**Requirement**:
- Buttons: `Aide F2`, `Valide F3`, `Sél F4`, `Règlt F5`, `Fiche F6`, `Impr F7`, `Ins F8`, `Suppr F10`, `Ticket F11`, `Prix`.
- **Improvement**:
  - Visual feedback on key press (active state).
  - Ensure all keys map to correct event handlers.
  - consistent styling that mimics the "retro" function key look but with modern interactivity.

## 3. State Management & Persistence

### 3.1 Temporary State Preservation
**Problem**: Switching between sub-sections (e.g., from "Vente en Gros" to "Vente au Détail" inside `SalesModule`) currently clears the entered line items.
**Requirement**:
- **Persistence**: The application must "remember" the state of each view (items in cart, selected customer, current reference) when navigating away and back.
- **Scope**: Entire project, but critical for the Sales/POS sections.
- **Implementation Hint**: Use a global store (Zustand) or a persistent context wrapper that keys state by "module ID" or "view ID" rather than clearing on unmount.

## 4. Business Logic Refactors

### 4.1 Reference Number ("Numéro de référence")
**Requirement**: The logic for generating reference numbers must be dynamic and robust.
- **Rules**:
  - **Structure**: Cannot be static. Must be incremental.
  - **Scope**: Unique per Session (or globally), dependent on the **Assigned Worker** and the **Store**.
  - **Format**: Numeric only for now (no letters), but designed to allow prefixes later.
  - **User Override**: The user must be able to manually edit the generated reference number, and the system should respect/remember that choice for the session if needed.

### 4.2 Client Data Binding (Two-Way)
**Requirement**: Real-time synchronization between Client Code (`CODE CLIENT`), Name (`DÉSIGNATION`), and Address.
- **Scenario A**: User types/selects "Client Code" -> Name and Address update immediately.
- **Scenario B**: User types/selects "Client Name" -> Client Code and Address update immediately.
- **Performance**: Must be instant. "Think deeply" implies handling edge cases (clearing one field should clear others, or handle partial matches).

### 4.3 Invoice Type Logic ("Facture" Types)
**Requirement**: Differentiate pricing and behavior based on the specific type of sale (Facture).
- **Types**: `Vente au Détail` (Retail), `Vente en Gros` (Wholesale), `Proforma`, etc.
- **Logic**:
  - **PRIX/PVG**: In Wholesale, show/use `PVG` (Prix de Vente Gros). In Retail, use standard Retail Price.
  - **Calculations**: Ensure total calculations respect the specific rules of the selected mode (e.g., taxes, discounts allowed).
  - "Think really deeply" implies verifying that the *defaults* and *validation rules* vary correctly between these modes.

## 5. Specific Feature Requests

### 5.1 Facture Search in "Règlements de bon"
**Target**: `ReglementsBonsModule.tsx`.
**Requirement**: Add an option/field to search for a "Bon" (Ticket/Voucher) specifically by its `numero de facture` (Invoice Number).

### 5.2 Editable Grid Cells
**Target**: `SanifereGrid.tsx`.
**Requirement**:
- User should be allowed to modify information directly in the grid.
- Columns: `DÉSIGNATION`, `Qté`, `PVG`/`PRIX`, `%Rem.`.
- **Interaction**: Clicking a cell turns it into an input field or opens a quick editor. "Change as I see fit".