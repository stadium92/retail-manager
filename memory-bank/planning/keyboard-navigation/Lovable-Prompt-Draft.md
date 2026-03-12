## Prompt for Lovable: Advanced Keyboard Navigation Engine

Hey Lovable! We are building a robust, high-speed, keyboard-only navigation system for the POS Worker interface. The users need to process sales extremely fast during rush hours without ever touching a mouse.

Here are the strict architectural requirements and features you need to implement. Think like a System Architect:

### 1. Architecture
- Do NOT scatter `useEffect` hooks everywhere.
- Create a dedicated folder: `src/modules/navigation`.
- Use `zustand` to create a `useKeyboardNavigationStore` that globally tracks:
  - `activeRowIndex` (number)
  - `activeColIndex` (number)
  - `mode` ('hover' | 'edit')
- Create a `NavigableCell` wrapper component that cells in the sales table will use. It should handle its own styling (e.g., a blue border when focused) by checking the Zustand store.

### 2. Global Scanner Interceptor
- Scanners simulate rapid keystrokes ending in 'Enter'.
- Create a `useScannerIntercept` hook. It must listen to `window` `keydown` events during the CAPTURE phase.
- If it detects rapid typing (> 5 chars in < 50ms) ending in `Enter`, it MUST call `e.preventDefault()` and `e.stopPropagation()` to prevent the active cell from registering the 'Enter' key.
- It should then fire a global event (or call a Zustand action) to add the scanned product, append an empty row, and jump focus to the new row.

### 3. Navigation Rules
- **Enter (on Designation cell):** Opens search. Enter again selects.
- **Enter (on other cells):** Switches mode from 'hover' to 'edit'.
- **Enter (while editing):** Saves, switches back to 'hover', and moves to the right column.
- **Arrows (Left/Right/Up/Down):** Moves focus across cells when in 'hover' mode.
- **Mouse Clicks:** If a user clicks a cell, the Zustand store MUST immediately update `activeRowIndex` and `activeColIndex` to match, ensuring keyboard arrows work seamlessly from the clicked position.
- **Bypass Key (Tab):** Pressing `Tab` must instantly jump the focus to the `Designation` column of the LAST (empty) row, ready for the next product.

Please implement the Zustand store, the interceptor hook, and the `NavigableCell` component first, so I can review the architecture before we integrate it into the actual Sales grids.