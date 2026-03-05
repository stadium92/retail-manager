# PRD: Worker Dashboard — Keyboard-Driven Navigation & Sales Speed Enhancement

---

## 1. What I Understood About the Prompt

The request is a **new feature** (not a bug fix) to make the worker-side dashboard **keyboard-driven** so that semi-literate store workers can operate the sales system rapidly, especially during rush hours.

The core idea has **two layers**:

### Layer 1 — Module-Level Navigation (Top Menu Bar)
- Workers should be able to use **Left/Right arrow keys** to navigate between top-level modules (Sales, Purchases, Files, Edition, Management, Stock, Program).
- This should work **immediately** on login — no click required to "activate" keyboard mode.

### Layer 2 — Table-Level Navigation (Inside Sales Grid)
- Inside any sales sub-module table, the cursor should **auto-focus** on the first empty row's **Designation** column.
- The worker types a product name → presses **Enter** → a dropdown search appears with matching products.
- After selecting a product, the cursor **hovers** (focuses) on the Designation cell.
- Pressing **Right Arrow** moves focus to the next column: Designation → SKU → Packaging → Stock → Price → Quantity → Discount → Total.
- **Enter** toggles edit mode on the focused cell; **Enter** again saves and exits edit mode.
- After reaching the **Total** column and pressing **Enter**, the cursor jumps to the **next empty row** at the Designation column, ready for the next product.
- A **barcode scanner** should auto-detect fast input and, after scanning, automatically jump to the next row (scan → next row → scan → next row, continuously).
- A **dedicated shortcut key** (not Enter) should allow skipping the current row entirely and jumping to the next empty row.

### Target Sub-Modules
The feature should apply to these four sales sub-modules:
| Prompt Name | Internal Module Key | Component |
|---|---|---|
| Retail Sales | `vente-detail` | `SalesModule.tsx` |
| Retail Billing | `facturation-detail` | `FacturationModule.tsx` |
| Wholesale Billing | `facturation-gros` | (Wholesale variant) |
| Performance Invoice (Proforma Invoice) | `proforma` | `ProformaList.tsx` / Proforma module |

### Conflicts Identified by the Requester
1. **Mouse click vs. keyboard hover** — Clicking anywhere in the table resets the keyboard navigation state. This creates a UX conflict.
2. **Scanner mode vs. keyboard mode** — When a barcode scanner fires rapid input, it could conflict with normal keyboard typing in the Designation column.
3. **Enter key overload** — Enter is used for: (a) opening the search dropdown, (b) selecting a product, (c) entering edit mode, (d) saving/exiting edit mode, (e) advancing to the next row. This is a lot of responsibility for one key.

---

## 2. What We Should Do

### 2.1 Create a `Navigation` Subdirectory
Create `frontend/src/Navigation/` (or `frontend/src/navigation/` following lowercase convention common in React/TS projects) as a dedicated module for all navigation logic. This mirrors the Python "module" pattern the requester mentioned, adapted for TypeScript:

```
frontend/src/navigation/
├── index.ts                    # Public API barrel export
├── types.ts                    # Navigation state types
├── useModuleNavigation.ts      # Hook: arrow-key module switching
├── useTableNavigation.ts       # Hook: arrow-key table cell navigation
├── useScannerNavigation.ts     # Hook: scanner-aware auto-advance
├── NavigationProvider.tsx       # Context provider for navigation state
├── constants.ts                # Column definitions, key mappings
└── utils.ts                    # Helpers (cell focus, scroll-into-view)
```

### 2.2 Module-Level Arrow Key Navigation
- Wrap the `WorkerLayout` with a `NavigationProvider` context.
- Register a global `keydown` listener for **Left Arrow** and **Right Arrow**.
- When no table cell is focused (i.e., the user is at the module level), arrow keys cycle through the module list defined in `WorkerMenuBar.tsx`.
- The active module changes via the existing `onModuleChange` callback.
- On login/mount, the navigation should be **immediately active** (no click required).

### 2.3 Table-Level Cell Navigation
- Inside each sales grid, use `useTableNavigation` hook.
- Maintain a `focusedCell: { row: number, col: number }` state.
- On mount, auto-focus on `{ row: 0, col: 0 }` (first row, Designation column).
- **Right Arrow**: Move to the next column.
- **Left Arrow**: Move to the previous column.
- **Down Arrow**: Move to the next row (same column).
- **Up Arrow**: Move to the previous row (same column).
- **Enter**: Toggle between "hover/focused" and "editing" states.
- **Tab**: Could also be used as a forward-navigation alternative (this is standard HTML behavior).

### 2.4 Search Dropdown on Designation Column
- When the user types in the Designation column and presses **Enter**, show a filtered product dropdown.
- Reuse the existing `ProductLookupDialog.tsx` logic (which already has ↑↓ navigate, Enter select, Esc close).
- Instead of a full dialog, adapt it to an **inline dropdown** anchored to the Designation cell.
- After product selection, auto-populate: Designation, SKU, Stock, Price (from product data). Focus moves to the Designation cell in "hover" mode.

### 2.5 Scanner Auto-Advance
- Use `useBarcodeScanner` hook (already exists) inside the navigation context.
- On scan detection: look up the product, populate the current row, and **auto-advance to the next empty row**.
- Scanner detection heuristic: input speed > 6 characters arriving within 100ms (typical barcode scanner behavior). The existing `hardwareBarcodeScanned` custom event from the Tauri backend already handles this.

### 2.6 Row Skip Button
- Assign **Escape** or **Tab** as the "skip row" key (see suggestions below for recommendation).
- When pressed, abandon the current row (if empty, remove it; if partially filled, keep it) and jump to the next empty row.

---

## 3. What We Should NOT Do

| ❌ Don't | Why |
|---|---|
| Rewrite the entire repository | The requester mentioned this as a possibility, but it is unnecessary. The current architecture (React + Zustand + Shadcn) fully supports this feature via hooks and context providers. |
| Replace React Router or change routing | Module navigation is internal to the worker dashboard (module switching), not URL-based page routing. |
| Create a separate npm package/repo for navigation | In TypeScript/React, a local module directory with barrel exports achieves the same modularity as a Python sub-repo. No need for a separate package. |
| Touch the Master dashboard | This feature is worker-only, sales-focused. |
| Modify the existing `ShortcutsContext` for this | The existing `ShortcutsContext` handles F-key shortcuts. Arrow-key navigation is a different concern and should live in its own context to avoid coupling. |
| Remove mouse/touch support | Keyboard navigation should **augment**, not replace, mouse/touch interaction. Both should coexist. |
| Change the underlying data model | This is purely a UI/UX navigation layer. No backend changes needed. |
| Add new npm dependencies for basic keyboard handling | Native `keydown` event listeners + React hooks are sufficient. No library needed for this. |

---

## 4. Plan of Execution

### Phase 1: Foundation (Navigation Module Scaffolding)
1. Create `frontend/src/navigation/` directory structure.
2. Define TypeScript types for navigation state (`NavigationMode`, `CellPosition`, `NavigationContext`).
3. Implement `NavigationProvider.tsx` context with global state.
4. Create `index.ts` barrel export.

### Phase 2: Module-Level Navigation
5. Implement `useModuleNavigation.ts` hook.
6. Integrate into `WorkerLayout.tsx` — register arrow key listeners.
7. Ensure module list order matches `WorkerMenuBar.tsx` visual order.
8. Add visual indicator for "keyboard-focused" module (distinct from "active" module).
9. Test: Arrow keys cycle modules on fresh login without any click.

### Phase 3: Table-Level Navigation
10. Implement `useTableNavigation.ts` hook with cell focus tracking.
11. Define column order constant: `['designation', 'sku', 'packaging', 'stock', 'price', 'quantity', 'discount', 'total']`.
12. Implement "hover" (focused but not editing) vs. "editing" (input active) states.
13. Implement Enter key behavior: toggle edit, search dropdown, save, advance.
14. Implement auto-focus on first row Designation on mount.
15. Integrate into `SanifereGrid.tsx` (the primary sales grid).

### Phase 4: Search Dropdown Integration
16. Extract search logic from `ProductLookupDialog.tsx` into a reusable hook.
17. Build an inline dropdown component for the Designation column.
18. Wire Enter → show dropdown → select product → populate row → return to hover.

### Phase 5: Scanner Integration
19. Implement `useScannerNavigation.ts` hook.
20. On scan: populate current row → auto-advance to next row.
21. Handle rapid successive scans (scan → next row → scan → next row).
22. Resolve conflict: scanner input vs. manual typing (use timing heuristic from existing `hardwareBarcodeScanned` event).

### Phase 6: Conflict Resolution & Polish
23. Implement mouse-click conflict resolution (see Section 6 below).
24. Implement row-skip shortcut key.
25. Add boundary guards (first/last row, first/last column, empty table).

### Phase 7: Propagate to All Sales Sub-Modules
26. Apply navigation to `vente-detail` (Retail Sales).
27. Apply navigation to `facturation-detail` (Retail Billing).
28. Apply navigation to `facturation-gros` (Wholesale Billing).
29. Apply navigation to `proforma` (Performance Invoice).
30. Each module may have slightly different column sets — use configuration objects.

### Phase 8: Testing & QA
31. Manual testing: keyboard-only workflow (login → navigate modules → enter sales → scan → complete sale).
32. Test scanner rapid-fire mode.
33. Test mouse + keyboard mixed usage.
34. Test edge cases: empty table, single row, last column, first column.
35. i18n: Ensure navigation works with all languages (EN, FR, BM).

---

## 5. My Suggestions & Recommendations

### 5.1 Recommended Libraries

| Library | Purpose | Why |
|---|---|---|
| **None required** | Keyboard handling | Native `KeyboardEvent` + React hooks are sufficient. Adding a library for this creates unnecessary dependency. |
| **@tanstack/react-table** (worth evaluating) | Table state management | If the sales grid becomes more complex, this library provides built-in cell focus and navigation APIs. However, the current `SanifereGrid` is custom and works well — only consider this for a future rewrite. |
| **cmdk** or **@radix-ui/react-combobox** | Inline search dropdown | The project already uses Radix UI extensively. A combobox primitive would give accessible, keyboard-navigable dropdowns for free. Already partially available via Shadcn's `Command` component. |
| **react-hotkeys-hook** | Shortcut management | Optional. Would simplify scoped shortcut registration per component. But the existing `ShortcutsContext` pattern is sufficient. |

**Bottom line: No new libraries are strictly necessary.** The existing stack (React + Zustand + Radix/Shadcn + native DOM events) can handle everything.

### 5.2 Row Skip Key Recommendation: **`Tab`**

| Key Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Tab** | Universal "next field" mental model; workers may know it from other software | Could conflict with browser tab-focus | ✅ **Recommended** — use `preventDefault` to capture it within the table |
| **Escape** | Clear "cancel/skip" meaning | Could conflict with closing dialogs/dropdowns | ❌ Too many conflicts |
| **Page Down** | Intuitive for "next row" | Not present on all keyboards; unfamiliar | ❌ Not reliable |
| **Ctrl+Enter** | Clear "advance" meaning | Two-key combo; harder for semi-literate users | ❌ Too complex |
| **`+`** (numpad) | Fast for numpad-equipped POS keyboards | Not on all keyboards | ⚠️ Secondary option |

**Recommendation**: Use **Tab** as the skip-row key. Within the sales table, `Tab` should:
- If on the **last column** (Total): advance to the next row's Designation column.
- If on **any other column**: advance to the next column (same as Right Arrow, but also exits edit mode).
- **Shift+Tab**: Go backward (previous column or previous row).

This is consistent with spreadsheet behavior (Excel, Google Sheets) that many users are familiar with.

### 5.3 Navigation Mode Indicator
Add a small visual indicator (e.g., a colored border or glow) around the currently keyboard-focused cell to make it obvious where the cursor is. This is critical for semi-literate users who need clear visual feedback.

Suggestion: Use a **2px solid teal border** (matching the app's teal theme from `WorkerLayout.tsx`) around the focused cell, and a **light teal background** for the focused row.

### 5.4 Suggested Column Edit Behavior

| Column | On Enter | Editable? | Notes |
|---|---|---|---|
| Designation | Opens search dropdown | Type-to-search | Primary input column |
| SKU (Code) | Enters edit mode | Yes (text input) | Usually auto-filled from product selection |
| Packaging (Cndt) | Toggles packaging type | Toggle (PC/BOX) | Use Enter to cycle through options |
| Stock | Enters edit mode | Yes (numeric) | Display-only in most cases; editable for manual override |
| Price | Enters edit mode | Yes (numeric) | Could also offer price-tier dropdown |
| Quantity | Enters edit mode | Yes (numeric) | Default to 1 |
| Discount (Rem%) | Enters edit mode | Yes (numeric %) | Default to 0 |
| Total (Montant) | **Auto-calculated** | **No** — read-only | Pressing Enter here advances to next row |

---

## 6. Deep Analysis: Conflict Resolution

### 6.1 Mouse Click vs. Keyboard Navigation

**The Problem**: If a user is navigating with the keyboard and then clicks somewhere with the mouse, the keyboard focus state becomes out of sync with the visual state.

**My Recommendation: "Last Input Wins"**

Implement a simple state machine with two modes:
- `keyboard` mode: Arrow keys and Enter control focus. Visual focus indicator is shown.
- `mouse` mode: Mouse clicks control focus. Visual focus indicator is hidden (standard browser focus behavior).

**Transition rules:**
- Any keyboard event (arrow, Enter, Tab) → switch to `keyboard` mode.
- Any mouse click on a table cell → switch to `mouse` mode, update `focusedCell` to the clicked cell.
- Any mouse click **outside** the table → exit table navigation entirely; return to module-level navigation.

This is the approach used by **VS Code**, **Excel**, and **macOS Finder** — it feels natural because the user's last input method always "wins."

**Implementation**: A single `navigationMode: 'keyboard' | 'mouse'` state variable in the `NavigationProvider`. The focused-cell border is only rendered in keyboard mode.

### 6.2 Scanner Mode vs. Manual Typing

**The Problem**: A barcode scanner sends characters extremely fast (the entire barcode in < 100ms), which could be confused with manual typing in the Designation field.

**My Recommendation: Use the Existing Tauri Scanner Event**

The codebase already has:
- `useBarcodeScanner.ts` — listens for `hardwareBarcodeScanned` custom events.
- The Tauri backend detects scanner hardware and fires the event.

**This means the conflict is already resolved at the hardware level.** The Tauri backend distinguishes scanner input from keyboard input before it reaches the frontend. The frontend only needs to:

1. Listen for `hardwareBarcodeScanned` events.
2. On scan: look up the product, populate the current row, advance to the next row.
3. Normal keyboard input in the Designation field is processed as usual.

**If the Tauri hardware detection is not available** (e.g., running in a browser without Tauri), implement a **timing-based fallback**:
- Buffer all keystrokes in the Designation field.
- If > 6 characters arrive within 100ms → treat as scanner input.
- Otherwise → treat as manual typing.

### 6.3 Enter Key Overload

**The Problem**: Enter is used for too many actions (search, select, edit, save, advance).

**My Recommendation: Context-Aware Enter**

Enter should behave differently based on the **current state** of the focused cell:

```
State Machine for Enter Key:

[HOVER mode] + Enter →
  ├── If Designation column → Open search dropdown
  ├── If Packaging column  → Toggle packaging type (cycle options)
  ├── If Total column      → Advance to next row
  └── If any other column  → Enter EDIT mode (activate input)

[EDIT mode] + Enter →
  └── Save value → Return to HOVER mode (same cell)

[SEARCH DROPDOWN open] + Enter →
  └── Select highlighted product → Populate row → Close dropdown → HOVER mode
```

This keeps Enter intuitive: it always does "the next logical thing" based on context. The user never has to think about which key to press — Enter always progresses the workflow forward.

---

## 7. Architecture Decision: Why Not a Full Rewrite?

The requester wondered if a full rewrite is needed. **It is not.** Here's why:

| Current Architecture | Support for This Feature |
|---|---|
| React hooks | Custom hooks (`useTableNavigation`, `useModuleNavigation`) can encapsulate all keyboard logic |
| Zustand stores | `usePOSStore` already tracks `activeRow` — extend it with `focusedCell` |
| Context providers | `NavigationProvider` wraps the worker layout, providing nav state to all sales modules |
| `SanifereGrid.tsx` | Already has arrow Up/Down, Delete, +/- keyboard handlers — extend, don't rewrite |
| `ShortcutsContext.tsx` | Already handles global keydown filtering — new navigation context coexists alongside it |
| `ProductLookupDialog.tsx` | Already has keyboard-navigable search — extract and reuse as inline dropdown |

The feature is a **UI layer addition**, not a structural change. The existing component architecture supports it cleanly.

---

## 8. Estimated Effort

| Phase | Effort | Risk |
|---|---|---|
| Phase 1: Foundation | 1-2 days | Low |
| Phase 2: Module Navigation | 1-2 days | Low |
| Phase 3: Table Navigation | 3-5 days | Medium (cell focus edge cases) |
| Phase 4: Search Dropdown | 2-3 days | Medium (inline dropdown positioning) |
| Phase 5: Scanner Integration | 1-2 days | Low (existing infrastructure) |
| Phase 6: Conflict Resolution | 2-3 days | High (state machine complexity) |
| Phase 7: Propagate to All Modules | 2-3 days | Low (repetitive) |
| Phase 8: Testing & QA | 2-3 days | Medium |
| **Total** | **~14-23 days** | — |

---

## 9. Summary of Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Navigation module location | `frontend/src/navigation/` | TypeScript barrel-export module, equivalent to Python sub-package |
| New libraries needed | **None** | Existing stack is sufficient |
| Row-skip key | **Tab** | Universal, spreadsheet-like, one key |
| Mouse vs. keyboard conflict | **"Last Input Wins"** | Natural, used by VS Code/Excel |
| Scanner vs. typing conflict | **Use existing Tauri hardware events** + timing fallback | Already solved at the hardware level |
| Enter key overload | **Context-aware state machine** | Enter always does "the next logical thing" |
| Full rewrite needed? | **No** | Hooks + context + existing grid support the feature |
| Navigation active on load? | **Yes** — auto-focus on mount | No click required to start navigating |

---

## 10. Open Questions for the Requester

1. **Column set per module**: Do all four sales sub-modules (Retail Sales, Retail Billing, Wholesale Billing, Proforma) have the exact same columns, or do some have extra/fewer columns?
2. **Stock column editability**: Should workers be able to manually edit the Stock column in the sales grid, or should it be display-only (auto-populated from inventory)?
3. **Price override**: Should workers be allowed to type a custom price, or must they select from the existing price tiers (detail/discount/bulk/resale)?
4. **Sound feedback**: Would an audible beep on scanner scan or row advance be helpful for workers?
5. **Mobile/tablet**: Should this keyboard navigation also work on tablets with external keyboards, or is it desktop-only?
6. **Training mode**: Would a "guided tour" overlay (showing which keys to press) be useful for onboarding new workers?
