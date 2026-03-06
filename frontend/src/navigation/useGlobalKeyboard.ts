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
      const state = getState();

      // 1. Any key press → switch to keyboard input method
      if (state.inputMethod !== 'keyboard') {
        store.setState({ inputMethod: 'keyboard' });
      }

      // ---------------------------------------------------------------
      // Scanner Detection Logic
      // ---------------------------------------------------------------
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      if (timeSinceLastKey > SCANNER_TIMING_THRESHOLD_MS) {
        scanBufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (scanBufferRef.current.length >= SCANNER_CHAR_THRESHOLD) {
          e.preventDefault();
          e.stopPropagation();

          const code = scanBufferRef.current;
          scanBufferRef.current = '';
          lastKeyTimeRef.current = now;

          window.dispatchEvent(new CustomEvent('scanner-input', { detail: { code } }));
          return;
        }
        scanBufferRef.current = '';
      } else if (e.key.length === 1) {
        scanBufferRef.current += e.key;
      }
      
      lastKeyTimeRef.current = now;

      // ---------------------------------------------------------------
      // Global Modifiers / Bypasses
      // ---------------------------------------------------------------
      if (e.key === 'Tab') {
        e.preventDefault();
        store.getState().jumpToLastEmptyRow();
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

      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // ---------------------------------------------------------------
      // While in HOVER mode (navigation between cells)
      // ---------------------------------------------------------------
      if (state.mode === 'hover' && !isInput && state.activeCell) {
        switch (e.key) {
          case 'ArrowRight':
            e.preventDefault();
            store.getState().moveRight();
            return;
          case 'ArrowLeft':
            e.preventDefault();
            store.getState().moveLeft();
            return;
          case 'ArrowDown':
            e.preventDefault();
            store.getState().moveDown();
            return;
          case 'ArrowUp':
            e.preventDefault();
            store.getState().moveUp();
            return;
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
            } else if (col !== 'stock' && col !== 'total') {
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

      // If we are navigating via grid but try to type, auto-enter edit AND capture the character
      if (state.mode === 'hover' && state.activeCell && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        store.getState().setMode('edit');
        
        // Dispatch an event to capture the first keystroke so it isn't lost
        window.dispatchEvent(new CustomEvent('nav-capture-keystroke', { 
            detail: { row: state.activeCell.row, col: state.activeCell.col, key: e.key } 
        }));
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
