# Ultimate Prompt for Lovable / Claude 3.5 Sonnet (Implementation Phase)

**Context:** We are implementing a high-performance, keyboard-only "Excel-like" navigation system for a POS application. The target users are fast cashiers during rush hours. We have already designed the architecture. Your task is to execute this specific architecture precisely. 

**DO NOT** rewrite existing routing, and **DO NOT** use `React Context` for grid coordinates to avoid re-render performance issues.

Please implement the following in the `frontend/src/navigation/` directory:

### 1. The Global Store (Zustand)
Create `useNavigationStore.ts` using Zustand. It must track:
- `activeCell: { row: number, col: number } | null`
- `mode: 'hover' | 'edit'`
- `inputMethod: 'mouse' | 'keyboard'`
Include actions to: `setCell`, `moveFocus(direction)`, `setMode`, and `setInputMethod`.

### 2. The Keyboard & Scanner Interceptor Hook
Create `useGlobalKeyboard.ts`. It must attach a `keydown` listener to the `window` (capture phase) to handle:
- **Mouse vs Keyboard Conflict:** Any key press sets `inputMethod` to `'keyboard'`. (Clicks should set it to `'mouse'` elsewhere).
- **Scanner Fallback:** Maintain a buffer of keystrokes. If > 6 chars are typed with < 50ms between them, ending in 'Enter', intercept it (`e.preventDefault()`, `e.stopPropagation()`), and dispatch a custom `scanner-input` event. Do NOT let it trigger UI edits.
- **The Bypass Key:** If `Tab` is pressed, prevent default, and set `activeCell` to the designation column of the `lastRowIndex` (which will be passed dynamically to the store).

### 3. The Context-Aware Cell Wrapper
Create a `<NavigableCell />` component. It takes props: `row`, `col`, `isEditable`, `columnType` (e.g., 'designation', 'packaging', 'standard', 'total').
It subscribes to the Zustand store. If `store.activeCell` matches its `row/col`, it renders a thick teal border (ONLY if `inputMethod === 'keyboard'`).
It must handle its own local `keydown` for the **Context-Aware Enter Key**:
- If `mode === 'hover'`:
  - If `Enter` and `columnType === 'designation'`: fire `onOpenSearch()`.
  - If `Enter` and `columnType === 'packaging'`: fire `onToggleUnit()`.
  - If `Enter` and `columnType === 'total'`: jump to next row's designation.
  - If `Enter` and `columnType === 'standard'`: call `store.setMode('edit')`.
- If `mode === 'edit'`:
  - If `Enter`: fire `onSave()`, call `store.setMode('hover')`, and move focus to the right column.

### 4. Implementation Steps
Please start by generating ONLY the `useNavigationStore.ts` and the `NavigableCell.tsx` components so I can verify the logic before we apply it to the main grid components.