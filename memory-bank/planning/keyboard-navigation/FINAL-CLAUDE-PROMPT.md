# FINAL INSTRUCTIONS FOR CLAUDE AGENT: Keyboard Navigation Engine

Hey Claude! We are implementing a high-performance, keyboard-driven "Excel-like" navigation system for our POS application. 

### 1. Context Acquisition (IMPORTANT)
Please cherry-pick and read the following files from the branch `main-cloud-build` to fully understand the architecture and the hybrid strategy we've decided upon:
- `memory-bank/planning/keyboard-navigation/PRD-Comparison-Analysis.md` (Read this first for the final strategy)
- `memory-bank/planning/keyboard-navigation/PRD-Keyboard-Navigation.md` (Initial requirements)
- `memory-bank/planning/keyboard-navigation/Implementation-Strategy.md` (Technical approach)
- `docs/PRD-Worker-Navigation-Enhancement.md` (Your previous PRD - note the specific feedback in the Comparison file)

### 2. Strategic Feedback on your previous PRD
While your initial PRD was excellent on UX details (Last Input Wins, Enter State Machine), the proposed use of **React Context** for grid coordinates is a **performance risk**. In a table with hundreds of cells, Context updates will cause massive re-renders. 
**Directive:** You MUST use **Zustand** for the navigation store to ensure granular subscriptions and high-speed cell traversal.

### 3. Core Task: Implementation
Create the following files in a new directory `frontend/src/navigation/`:

#### A. `useNavigationStore.ts` (Zustand)
Track: `activeCell: { row: number, col: number } | null`, `mode: 'hover' | 'edit'`, and `inputMethod: 'mouse' | 'keyboard'`. 
Include actions for movement, cell selection, and mode switching.

#### B. `useGlobalKeyboard.ts` (Global Interceptor)
- Handle the **Mouse vs Keyboard** switch (any keypress sets `inputMethod` to `'keyboard'`).
- Implement the **Scanner Fallback**: 50ms keystroke timing buffer to intercept rapid scanner input and dispatch a `scanner-input` event (bypass UI edits).
- Handle the **Bypass Key (Tab)**: Jump focus immediately to the `Designation` column of the last empty row.

#### C. `NavigableCell.tsx` (Component Wrapper)
Wrap table cells. It must:
- Subscribe to the Zustand store (using selectors for performance).
- Render a thick teal border if focused AND `inputMethod === 'keyboard'`.
- Implement the **Context-Aware Enter Key** logic:
  - Designation -> Open search.
  - Packaging -> Toggle Unit.
  - Total -> Jump to next row.
  - Standard -> Enter 'edit' mode.

### 4. Goal
Please generate these three core architectural pieces first. We will integrate them into the existing grids (`SalesModule`, etc.) in the next step.
