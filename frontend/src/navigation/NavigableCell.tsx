import React, { useCallback, useRef, useEffect } from 'react';
import {
  useNavigationStore,
  GRID_COLUMNS,
  type GridColumn,
} from './useNavigationStore';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface NavigableCellProps {
  /** Row index (0-based) in the grid. */
  row: number;
  /** Column identifier – must match one of the GRID_COLUMNS entries. */
  column: GridColumn;
  /** Content to render inside the cell. */
  children: React.ReactNode;
  /** Extra className applied to the outer wrapper. */
  className?: string;
  /**
   * Callback fired when the cell should enter "search" mode.
   * Only relevant for the Designation column (Enter → open search).
   */
  onOpenSearch?: () => void;
  /**
   * Callback fired when the Packaging / conditionnement column receives
   * an Enter press (toggle unit PC ↔ BOX).
   */
  onToggleUnit?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * Wrapper for individual table cells in the SanifereGrid (or any navigable
 * sales grid).  It subscribes to the Zustand navigation store via
 * **selectors** so that only the cells whose focus state actually changes
 * will re-render – critical for grids with hundreds of cells.
 *
 * Visual behaviour
 * ────────────────
 * • When the cell is the `activeCell` AND `inputMethod === 'keyboard'`, a
 *   thick teal border is rendered to clearly indicate keyboard focus.
 * • In mouse mode (`inputMethod === 'mouse'`), the teal border is hidden
 *   so the standard hover / click UX is unimpaired.
 *
 * Context-Aware Enter Key
 * ───────────────────────
 * The Enter key behaviour is column-dependent:
 *   • **designation** → fires `onOpenSearch` (shows product search dropdown).
 *   • **conditionnement** → fires `onToggleUnit` (cycles PC / BOX).
 *   • **total** → advances to the next row (read-only column).
 *   • **all other columns** → enters edit mode (standard behaviour, handled
 *     by the global keyboard hook).
 *
 * The component itself only needs to handle the column-specific callbacks
 * (search, toggle). Generic hover↔edit transitions are already managed by
 * `useGlobalKeyboard`.
 */
export function NavigableCell({
  row,
  column,
  children,
  className,
  onOpenSearch,
  onToggleUnit,
}: NavigableCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Granular Zustand selectors – each cell only re-renders when its own
  // focus state changes, NOT when any other cell moves.
  // -----------------------------------------------------------------------
  const colIndex = GRID_COLUMNS.indexOf(column);

  const isFocused = useNavigationStore(
    (s) =>
      s.activeCell !== null &&
      s.activeCell.row === row &&
      s.activeCell.col === colIndex,
  );

  const inputMethod = useNavigationStore((s) => s.inputMethod);
  const mode = useNavigationStore((s) => s.mode);

  const showFocusBorder = isFocused && inputMethod === 'keyboard';
  const isEditing = isFocused && mode === 'edit';

  // -----------------------------------------------------------------------
  // Auto-scroll into view when focused via keyboard
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (showFocusBorder && cellRef.current) {
      cellRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [showFocusBorder]);

  // -----------------------------------------------------------------------
  // Click handler – "Last Input Wins" → mouse focuses the cell
  // -----------------------------------------------------------------------
  const handleClick = useCallback(() => {
    const store = useNavigationStore.getState();
    store.setActiveCell({ row, col: colIndex });
    store.setInputMethod('mouse');
  }, [row, colIndex]);

  // -----------------------------------------------------------------------
  // Local Enter handler for column-specific actions.
  // This fires *before* the global handler because we use an onKeyDown
  // on the cell div. We stop propagation only when we consume the event.
  // -----------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' || !isFocused) return;
      if (mode !== 'hover') return; // only intercept in hover mode

      if (column === 'designation' && onOpenSearch) {
        e.preventDefault();
        e.stopPropagation();
        onOpenSearch();
        return;
      }

      if (column === 'conditionnement' && onToggleUnit) {
        e.preventDefault();
        e.stopPropagation();
        onToggleUnit();
        return;
      }

      // For 'total' and standard columns the global keyboard hook handles
      // the Enter key – we let the event propagate.
    },
    [isFocused, mode, column, onOpenSearch, onToggleUnit],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div
      ref={cellRef}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={className}
      data-nav-row={row}
      data-nav-col={column}
      style={
        showFocusBorder
          ? {
              outline: '2px solid hsl(160, 70%, 35%)',
              outlineOffset: '-2px',
              position: 'relative' as const,
              zIndex: 1,
              background: isEditing
                ? 'hsla(160, 70%, 35%, 0.15)'
                : undefined,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
