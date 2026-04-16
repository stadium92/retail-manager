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
  const pendingKeystroke = useNavigationStore((s) => s.pendingKeystroke);
  const setMode = useNavigationStore((s) => s.setMode);
  const setActiveCell = useNavigationStore((s) => s.setActiveCell);
  const clearPendingKeystroke = useNavigationStore((s) => s.clearPendingKeystroke);
  
  const isEditing = isFocused && mode === 'edit';

  // -----------------------------------------------------------------------
  // Type-to-Edit: Inject the captured keystroke when entering edit mode
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isEditing && pendingKeystroke !== null && cellRef.current) {
        const focusable = cellRef.current.querySelector('input, button') as HTMLElement;
        if (focusable) {
          focusable.focus();
          
          if (focusable instanceof HTMLInputElement && focusable.type !== 'button' && focusable.type !== 'submit') {
            // Overwrite existing value as requested
            focusable.value = pendingKeystroke;
            
            // Trigger React update
            const event = new Event('input', { bubbles: true });
            focusable.dispatchEvent(event);
            
            // Move cursor to the end
            setTimeout(() => {
                focusable.selectionStart = focusable.selectionEnd = 1;
            }, 0);
          }
          
          // CRITICAL: Clear the key so we don't inject it again on re-render
          clearPendingKeystroke();
        }
    }
  }, [isEditing, pendingKeystroke, clearPendingKeystroke]);

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
