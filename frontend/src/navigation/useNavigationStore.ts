import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Column definitions – order matches the SanifereGrid visual layout.
// Consumers import GRID_COLUMNS to configure NavigableCell instances.
// ---------------------------------------------------------------------------
export const GRID_COLUMNS = [
  'designation',
  'code',
  'conditionnement',
  'stock',
  'price',
  'quantity',
  'discount',
  'total',
] as const;

export type GridColumn = (typeof GRID_COLUMNS)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CellPosition {
  row: number;
  col: number;
}

export type NavigationMode = 'hover' | 'edit';
export type InputMethod = 'mouse' | 'keyboard';

export interface NavigationState {
  /** Currently focused cell, or null when no cell is active. */
  activeCell: CellPosition | null;
  /** "hover" = cell is highlighted but not being edited; "edit" = input active. */
  mode: NavigationMode;
  /** Tracks how the user last interacted – drives visual focus indicator. */
  inputMethod: InputMethod;
  /** Total number of data rows currently in the grid (set by the host grid). */
  rowCount: number;
}

export interface NavigationActions {
  // --- Movement ---
  moveRight: () => void;
  moveLeft: () => void;
  moveDown: () => void;
  moveUp: () => void;

  // --- Cell selection ---
  /** Programmatically jump to a specific cell. */
  setActiveCell: (pos: CellPosition | null) => void;
  /** Jump to the Designation column of the last empty row (Tab bypass). */
  jumpToLastEmptyRow: () => void;
  /** Advance to the Designation column of the next row (used after Total col or scanner). */
  advanceToNextRow: () => void;

  // --- Mode switching ---
  setMode: (mode: NavigationMode) => void;
  /** Toggle between hover and edit (Enter key behaviour). */
  toggleMode: () => void;

  // --- Input method ---
  setInputMethod: (method: InputMethod) => void;

  // --- Grid metadata ---
  setRowCount: (count: number) => void;
}

export type NavigationStore = NavigationState & NavigationActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useNavigationStore = create<NavigationStore>()((set, get) => ({
  // --- State defaults ---
  activeCell: null, // Default to null so focus is not captured immediately
  mode: 'hover',
  inputMethod: 'keyboard',
  rowCount: 0,

  // --- Movement ---------------------------------------------------
  moveRight: () => {
    const { activeCell, mode } = get();
    if (!activeCell || mode === 'edit') return;
    const nextCol = Math.min(activeCell.col + 1, GRID_COLUMNS.length - 1);
    set({ activeCell: { row: activeCell.row, col: nextCol }, mode: 'hover' });
  },

  moveLeft: () => {
    const { activeCell, mode } = get();
    if (!activeCell || mode === 'edit') return;
    const prevCol = Math.max(activeCell.col - 1, 0);
    set({ activeCell: { row: activeCell.row, col: prevCol }, mode: 'hover' });
  },

  moveDown: () => {
    const { activeCell, rowCount, mode } = get();
    if (!activeCell || mode === 'edit') return;
    const nextRow = Math.min(activeCell.row + 1, Math.max(rowCount - 1, 0));
    set({ activeCell: { row: nextRow, col: activeCell.col }, mode: 'hover' });
  },

  moveUp: () => {
    const { activeCell, mode } = get();
    if (!activeCell || mode === 'edit') return;
    const prevRow = Math.max(activeCell.row - 1, 0);
    set({ activeCell: { row: prevRow, col: activeCell.col }, mode: 'hover' });
  },

  // --- Cell selection ---
  setActiveCell: (pos) => set({ activeCell: pos, mode: 'hover' }),

  jumpToLastEmptyRow: () => {
    const { rowCount } = get();
    // Since we ensure an empty row always exists, target the very last row index.
    set({
      activeCell: { row: Math.max(rowCount - 1, 0), col: 0 },
      mode: 'hover',
    });
  },

  advanceToNextRow: () => {
    const { activeCell, rowCount } = get();
    const nextRow = activeCell ? activeCell.row + 1 : rowCount;
    set({
      activeCell: { row: Math.max(nextRow, 0), col: 0 },
      mode: 'hover',
    });
  },

  // --- Mode switching ---
  setMode: (mode) => set({ mode }),
  toggleMode: () => {
    const { mode } = get();
    set({ mode: mode === 'hover' ? 'edit' : 'hover' });
  },

  // --- Input method ---
  setInputMethod: (method) => set({ inputMethod: method }),

  // --- Grid metadata ---
  setRowCount: (count) => set({ rowCount: count }),
}));
