# Implementation Strategy: Excel-like Navigation Grid

## 1. Directory Structure Proposal
```typescript
frontend/src/modules/navigation/
├── store/
│   └── useKeyboardNavigationStore.ts  // Zustand store for active cell coordinates [row, col] and mode [hover|edit]
├── hooks/
│   ├── useGridNavigation.ts           // Connects UI components to the store
│   └── useScannerIntercept.ts         // Global hook to catch rapid inputs and dispatch 'SCAN' events
├── components/
│   ├── NavigableGrid.tsx              // Wrapper that listens to global keyboard events for grid traversal
│   ├── NavigableRow.tsx               
│   └── NavigableCell.tsx              // Handles focus/edit styling and local enter-to-edit logic
└── types/
    └── navigation.types.ts
```

## 2. Resolving the "Hover vs Click" Conflict
**Challenge:** The user uses arrow keys to reach row 2, col 3. Then, they use the mouse to click row 5, col 1. If not handled correctly, the next arrow key press might jump back to row 2.

**Solution:**
The `NavigableCell` component must have an `onClick` handler that dispatches an action to the `useKeyboardNavigationStore` to update the global `[row, col]` coordinates immediately to the clicked cell's coordinates.

```typescript
// Conceptual example
const handleCellClick = () => {
  setCoordinates(rowIndex, colIndex);
  if (isEditable) {
     setMode('edit');
  }
}
```

## 3. Resolving the Scanner Conflict
**Challenge:** A barcode scanner acts like a keyboard, typing e.g., `123456789012` in ~20ms, followed by `Enter`. If a user is focused on the "Quantity" cell and scans a product, the scanner might type "1234..." into the quantity field and press enter.

**Solution: The Global Interceptor**
```typescript
// useScannerIntercept.ts
let inputBuffer = '';
let lastKeystrokeTime = 0;

window.addEventListener('keydown', (e) => {
  const now = Date.now();
  if (now - lastKeystrokeTime > 50) { // 50ms gap means human typing
     inputBuffer = ''; 
  }
  
  if (e.key === 'Enter') {
     if (inputBuffer.length > 5) {
        e.preventDefault(); // Stop the Enter key from triggering cell edits
        e.stopPropagation();
        triggerScanEvent(inputBuffer);
     }
     inputBuffer = '';
  } else {
     inputBuffer += e.key;
  }
  lastKeystrokeTime = now;
}, true); // Use capturing phase to intercept before React Synthetic events
```
When `triggerScanEvent` fires:
1. Lookup product.
2. Add to cart (updates Zustand cart store).
3. The store automatically appends an empty row at the bottom.
4. Dispatch an event to `useKeyboardNavigationStore` to move focus to `[newRowIndex, designationColIndex]`.

## 4. Bypassing Row Navigation (The "Tab" Key)
The user requested a key to jump straight to the next empty row. We will map this to the `Tab` key (or a dedicated Function key like `F4` if Tab conflicts with browser defaults).

```typescript
// Inside useGridNavigation global listener
if (e.key === 'Tab') {
   e.preventDefault();
   const lastRowIndex = cartItems.length; // The empty row
   setCoordinates(lastRowIndex, DESIGNATION_COL_INDEX);
}
```