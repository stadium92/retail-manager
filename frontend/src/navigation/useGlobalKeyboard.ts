import { useEffect, useRef } from 'react';
import { useNavigationStore, GRID_COLUMNS } from './useNavigationStore';

// ---------------------------------------------------------------------------
// Scanner-input fallback
// ---------------------------------------------------------------------------
const SCANNER_TIMING_THRESHOLD_MS = 50;
const SCANNER_CHAR_THRESHOLD = 6;

export function useGlobalKeyboard() {
  const scanBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const store = useNavigationStore;
    const getState = store.getState;

    function handleKeyDown(e: KeyboardEvent) {
const isDialogOpen = !!document.querySelector('[role="dialog"]');
      
      // 0. HANDLE GLOBAL SHORTCUTS FIRST (Allow them even if focused in an input)
      if (e.key === 'F4' || e.key === 'F2') {
          if (!isDialogOpen) {
              e.preventDefault();
              e.stopPropagation();
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
              window.dispatchEvent(new CustomEvent('nav-pay-shortcut'));
              return;
          }
      }
      if (e.key === 'F3') {
          if (!isDialogOpen) {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('nav-search-shortcut'));
              return;
          }
      }
      if (e.key === 'F7') {
          if (!isDialogOpen) {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('nav-next-row', { detail: { row: state.activeCell?.row, forceNew: true } }));
              return;
          }
      }
      if (e.key === 'F10') {
          if (!isDialogOpen) {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('nav-save-shortcut'));
              return;
          }
      }

      if (isDialogOpen) return; // Completely ignore grid keys when a dialog is open

      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const state = getState();

      // ---------------------------------------------------------------
      // Global Modifiers / Bypasses
      // ---------------------------------------------------------------
      if (e.key === 'Tab') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        setTimeout(() => store.getState().jumpToLastEmptyRow(), 10);
        return;
      }

      // NEXT ROW SHORTCUTS: Shift (outside input) or Shift+Enter (anywhere)
      if ((e.key === 'Shift' && !isInput) || (e.key === 'Enter' && e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        
        // Release focus from any input so arrows can navigate the grid
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        window.dispatchEvent(new CustomEvent('nav-next-row', { 
            detail: { row: getState().activeCell?.row ?? -1 } 
        }));
        return;
      }

      // ---------------------------------------------------------------
      // While in EDIT mode (cursor is inside an input)
      // ---------------------------------------------------------------
      if (state.mode === 'edit') {
        if (e.key === 'Enter') {
          e.preventDefault();
          
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }

          if (state.activeCell) {
            const col = GRID_COLUMNS[state.activeCell.col];
            if (col === 'designation') {
              window.dispatchEvent(new CustomEvent('nav-open-search', { detail: { row: state.activeCell.row } }));
            }
            
            store.getState().setMode('hover');
            if (col !== 'total') {
              store.getState().moveRight();
            }
          }
          return;
        }
        
        if (e.key === 'Escape') {
          e.preventDefault();
          store.getState().setMode('hover');
          return;
        }
      }


      // ---------------------------------------------------------------
      // While in HOVER mode (navigation between cells)
      // ---------------------------------------------------------------
      if (state.mode === 'hover' && !isInput && state.activeCell) {
        // --- Type-to-Edit Capture ---
        // If it's a single character (letter/number), enter edit mode and capture it
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          store.getState().startEditWithKey(e.key);
          return;
        }

        switch (e.key) {
          case 'ArrowRight':
            e.preventDefault();
            store.getState().moveRight();
            return;
          case 'ArrowLeft':
            e.preventDefault();
            store.getState().moveLeft();
            return;
          case 'ArrowDown': {
              e.preventDefault();
              const col = GRID_COLUMNS[state.activeCell.col];
              if (col === 'price') {
                  window.dispatchEvent(new CustomEvent('nav-adjust-price', { detail: { row: state.activeCell.row, delta: -1 } }));
              } else if (col === 'quantity') {
                  window.dispatchEvent(new CustomEvent('nav-adjust-quantity', { detail: { row: state.activeCell.row, delta: -1 } }));
              } else {
                  store.getState().moveDown();
              }
              return;
            }
          case 'ArrowUp': {
              e.preventDefault();
              const col = GRID_COLUMNS[state.activeCell.col];
              if (col === 'price') {
                  window.dispatchEvent(new CustomEvent('nav-adjust-price', { detail: { row: state.activeCell.row, delta: 1 } }));
              } else if (col === 'quantity') {
                  window.dispatchEvent(new CustomEvent('nav-adjust-quantity', { detail: { row: state.activeCell.row, delta: 1 } }));
              } else {
                  store.getState().moveUp();
              }
              return;
            }
          case '+':
          case '=': {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('nav-adjust-quantity', { detail: { row: state.activeCell.row, delta: 1 } }));
            return;
          }
          case '-': {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('nav-adjust-quantity', { detail: { row: state.activeCell.row, delta: -1 } }));
            return;
          }
          case 'Delete':
          case 'Backspace': {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('nav-delete-row', { detail: { row: state.activeCell.row, key: e.key } }));
            return;
          }
          case 'Enter': {
            e.preventDefault();
            const col = GRID_COLUMNS[state.activeCell.col];

            if (col === 'total') {
                store.getState().advanceToNextRow();
            } else if (col === 'conditionnement') {
                window.dispatchEvent(new CustomEvent('nav-toggle-packing', { detail: { row: state.activeCell.row } }));
            } else if (col === 'designation' || col === 'price' || col === 'code') {
                // JUMP TO QUANTITY
                store.getState().setActiveCell({ row: state.activeCell.row, col: 5 });
            } else {
                store.getState().setMode('edit');
            }
            return;
          }
          case 'Escape':
            e.preventDefault();
            store.getState().setActiveCell(null);
            return;
        }
      }
    }

    function handleMouseDown() {
      if (getState().inputMethod !== 'mouse') {
        store.setState({ inputMethod: 'mouse' });
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handleMouseDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handleMouseDown, true);
      if (scanTimerRef.current !== null) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, []);
}
