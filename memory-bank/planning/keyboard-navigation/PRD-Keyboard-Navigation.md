# Product Requirements Document (PRD): Advanced Keyboard Navigation for POS

## 1. Executive Summary
The goal is to implement an advanced, robust, and highly intuitive keyboard-centric navigation system for the Worker (Cashier) interface of the Retail Manager application. The target users may have limited digital literacy, meaning the system must behave predictably, forgivingly, and exactly like traditional, hardware-based POS systems. The primary focus is maximum speed during "rush hours".

## 2. Core Objectives
- **Zero-Mouse Operations:** Cashiers should be able to complete a full transaction (scanning, manual search, quantity adjustment, and payment) without touching the mouse.
- **Architectural Scalability:** Create a dedicated `Navigation` module/system in the frontend that manages focus state, preventing scattered `useEffect` hooks and messy ref-forwarding across the codebase.
- **Scanner Integration:** Seamlessly differentiate between manual rapid typing and automated barcode scanner inputs.

## 3. Features & Requirements

### 3.1 Global Module Navigation
- **Default Focus:** Upon logging in or loading the worker dashboard, the focus must be instantly active on a sensible default (e.g., the Sales module or the primary navigation bar).
- **Arrow Key Traversal:** Left/Right arrows must allow the user to cycle through the main modules (Sales, Purchases, Files, Edition, Management).

### 3.2 Sales Grid Interaction (The "Excel-like" Experience)
- **Persistent Empty Row:** The sales table must *always* have an empty row ready for input at the bottom.
- **Cell States:** A cell can be in two states:
  - `Hovering/Focused`: Arrow keys navigate between cells.
  - `Editing`: Arrow keys move the text cursor. `Enter` saves and returns to `Hovering` state.
- **Keyboard Mapping within Table:**
  - `Enter` (on Designation): Opens search dropdown. `Enter` again selects the highlighted item.
  - `Right/Left Arrows`: Move focus between columns (Designation -> SKU -> Packaging -> Stock/Qty -> Price -> Discount -> Total).
  - `Enter` (on a selected cell): Enters `Editing` mode.
  - `Enter` (while Editing): Saves value, exits `Editing` mode.
  - `Tab` (Proposed New Key): Bypass the row navigation and immediately jump to the *next empty row's* Designation cell to start a new item.

### 3.3 Conflict Resolution Strategies
- **The "Click" Conflict:** If a user clicks away while hovering/editing, the system must gracefully auto-save the current edit, exit editing mode, and transfer the `Hovering/Focused` state to the clicked element without breaking the keyboard navigation loop.
- **The Scanner Conflict:**
  - **Problem:** Scanners act as keyboards. They type a string rapidly and append an `Enter` keypress. This can trigger UI events unintentionally if focused on the wrong cell.
  - **Solution (Heuristic & Global Listener):** Implement a global "Scanner Hook" that listens to keystrokes. If input velocity is > X characters per millisecond ending in `Enter`, classify it as a scan, intercept the event so it doesn't trigger cell edits.
  - **Behavior:** On scan, automatically add the product, calculate totals, and immediately move the virtual focus to the *next empty row's* designation cell.

## 4. Scope
- Apply to: Retail Sales, Retail Billing, Wholesale Billing, Proforma Invoice.

## 5. Architectural Proposal
To avoid React re-render hell, we will not use standard state for active cell coordinates. We will explore using a Context Provider backed by a mutable Ref or a specialized state management library (like Zustand or Jotai) specifically dedicated to `KeyboardFocusStore`.
