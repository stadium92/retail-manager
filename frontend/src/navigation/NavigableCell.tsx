import React, { useCallback, useRef, useEffect } from 'react';
import {
  useNavigationStore,
  GRID_COLUMNS,
  type GridColumn,
} from './useNavigationStore';

// Darker and bolder teal accent for better visibility
const FOCUS_OUTLINE_COLOR = '#000000'; // Pure black for maximum contrast
const FOCUS_EDIT_BG = 'rgba(255, 255, 255, 0.2)';

export interface NavigableCellProps {
  row: number;
  column: GridColumn;
  children: React.ReactNode;
  className?: string;
  isEditable?: boolean; // If false, the cell can be focused but won't trigger "edit" mode
  onOpenSearch?: () => void; // specific to Designation
  onToggleUnit?: () => void; // specific to Packaging
  onSave?: (val: string) => void;
}

export function NavigableCell({
  row,
  column,
  children,
  className,
  isEditable = true,
  onOpenSearch,
  onToggleUnit,
}: NavigableCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);
  
  // Use granular selectors so ONLY the active cell re-renders
  const isFocused = useNavigationStore(
    (s) => s.activeCell?.row === row && s.activeCell?.col === GRID_COLUMNS.indexOf(column)
  );
  
  const mode = useNavigationStore((s) => s.mode);
  const inputMethod = useNavigationStore((s) => s.inputMethod);
  const setMode = useNavigationStore((s) => s.setMode);
  const setActiveCell = useNavigationStore((s) => s.setActiveCell);
  
  const isEditing = isFocused && mode === 'edit';

  // -----------------------------------------------------------------------
  // Type-to-Edit: Capture the first keystroke from hover mode
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handleCapture = (e: any) => {
      const { row: targetRow, col: targetCol } = e.detail;
      const myCol = GRID_COLUMNS.indexOf(column);
      
      if (isFocused && row === targetRow && myCol === targetCol) {
        // We are the target!
        const focusable = cellRef.current?.querySelector('input, button') as HTMLElement;
        if (focusable) {
          // If it's the designation column, we don't want to focus the background input 
          // because SalesModule is going to open the ProductLookupDialog which takes focus.
          if (column === 'designation') {
              return;
          }
          // Simply focus for other columns (Quantity, Price). 
          // The SalesModule state update will handle the value.
          focusable.focus();
        }
      }
    };

    window.addEventListener('nav-capture-keystroke', handleCapture);
    return () => window.removeEventListener('nav-capture-keystroke', handleCapture);
  }, [isFocused, row, column]);

  // -----------------------------------------------------------------------
  // Auto-scroll logic when focused via keyboard
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isFocused && inputMethod === 'keyboard' && cellRef.current) {
      cellRef.current.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [isFocused, inputMethod]);

  // -----------------------------------------------------------------------
  // Auto-focus input when entering edit mode
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  // Auto-focus input when entering edit mode
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isEditing && cellRef.current) {
      // Find the first input or button inside this cell
      const focusableElement = cellRef.current.querySelector('input, button') as HTMLElement;
      if (focusableElement) {
        // Use a small timeout to let React render the input if it was conditionally hidden
        setTimeout(() => focusableElement.focus(), 50);
      }
    } else if (!isEditing && cellRef.current) {
       // Exiting edit mode: blur the input so cursor doesn't stay stuck
       const focusableElement = cellRef.current.querySelector('input, button') as HTMLElement;
       if (focusableElement) {
          focusableElement.blur();
       }
    }
  }, [isEditing]);

  // -----------------------------------------------------------------------
  // Mouse interaction
  // -----------------------------------------------------------------------
  const handleClick = useCallback(() => {
    const colIndex = GRID_COLUMNS.indexOf(column);
    setActiveCell({ row, col: colIndex });
    
    // If it's a standard editable column, a click should ideally enter edit mode
    // (Optional UX decision, but standard for grids)
    if (isEditable && column !== 'designation' && column !== 'conditionnement' && column !== 'total') {
       setMode('edit');
    }
  }, [row, column, setActiveCell, setMode, isEditable]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div
      ref={cellRef}
      onClick={handleClick}
      className={className}
      style={
        isFocused && inputMethod === 'keyboard'
          ? {
              outline: `3px solid ${FOCUS_OUTLINE_COLOR}`,
              outlineOffset: '-2px',
              position: 'relative' as const,
              zIndex: 10,
              background: isEditing ? FOCUS_EDIT_BG : undefined,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
