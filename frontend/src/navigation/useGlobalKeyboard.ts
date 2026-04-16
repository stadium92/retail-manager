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

      // NEW: F7 for New Row
      if (e.key === 'F7') {
          if (!isDialogOpen) {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('nav-next-row', { detail: { row: getState().activeCell?.row, forceNew: true } }));
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

      // 1. Any key press → switch to keyboard input method
      if (state.inputMethod !== 'keyboard') {
        store.setState({ inputMethod: 'keyboard' });
      }

      // ---------------------------------------------------------------
      // Scanner Detection Logic (RESTORED)
      // ---------------------------------------------------------------
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter' && !e.shiftKey) { // Normal Enter (not Shift+Enter)
        if (scanBufferRef.current.length >= SCANNER_CHAR_THRESHOLD) {
          e.preventDefault();
          e.stopPropagation();
          const code = scanBufferRef.current;
          scanBufferRef.current = '';
          (window as any).isScannerTyping = false;
          window.dispatchEvent(new CustomEvent('scanner-input', { detail: { code } }));
          return;
        }
        scanBufferRef.current = '';
      } else if (e.key.length === 1) {
        const isSuperHumanSpeed = timeSinceLastKey < 35;
        if (isSuperHumanSpeed) {
          scanBufferRef.current += e.key;
          (window as any).isScannerTyping = true;
          if (scanBufferRef.current.length >= 2) {
             e.preventDefault();
             e.stopPropagation();
          }
        } else {
          scanBufferRef.current = e.key; 
          (window as any).isScannerTyping = false;
          if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
          scanTimerRef.current = setTimeout(() => {
            if (!(window as any).isScannerTyping) {
              scanBufferRef.current = '';
            }
          }, 100);
        }
      }

      // ---------------------------------------------------------------
      // Global Modifiers / Bypasses
      // ---------------------------------------------------------------
      if (e.key === 'Tab') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        setTimeout(() => store.getState().jumpToLastEmptyRow(), 10);
        return;
      }

      // NEW: Shift (standalone) or Shift+Enter for Next Row
      if ((e.key === 'Shift' && !isInput) || (e.key === 'Enter' && e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          window.dispatchEvent(new CustomEvent('nav-next-row', { detail: { row: getState().activeCell?.row } }));
          return;
      }

      // ---------------------------------------------------------------
      // While in EDIT mode (cursor is inside an input)
      // ---------------------------------------------------------------
      if (state.mode === 'edit') {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          store.getState().setMode('edit');
          
          window.dispatchEvent(new CustomEvent('nav-capture-keystroke', { 
              detail: { row: state.activeCell.row, col: state.activeCell.col, key: e.key } 
          }));
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
