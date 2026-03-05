import { useEffect, useRef } from 'react';
import { useNavigationStore, GRID_COLUMNS } from './useNavigationStore';

// ---------------------------------------------------------------------------
// Scanner-input fallback
// ---------------------------------------------------------------------------
// Most barcode scanners inject characters very rapidly (entire barcode in
// <100 ms). We detect this by buffering keystrokes and flushing when the
// inter-key gap exceeds SCANNER_DEBOUNCE_MS.  If the buffer fills fast
// enough (≥ MIN_SCANNER_LENGTH characters in ≤ SCANNER_WINDOW_MS) we treat
// the whole burst as a scanner read and dispatch a custom event.
// ---------------------------------------------------------------------------
const SCANNER_DEBOUNCE_MS = 50;
const SCANNER_WINDOW_MS = 100;
const MIN_SCANNER_LENGTH = 6;

/**
 * Global keyboard interceptor.
 *
 * Mount this hook **once** at the top of the worker layout (e.g. inside
 * `WorkerLayout.tsx`).  It is responsible for:
 *
 * 1. Switching `inputMethod` to `'keyboard'` on any keypress (the
 *    "Last Input Wins" strategy). A separate `mousedown` listener switches
 *    back to `'mouse'`.
 *
 * 2. Arrow-key and Tab navigation in `hover` mode.
 *
 * 3. Scanner fallback detection (50 ms keystroke-timing buffer).
 *
 * 4. Tab bypass – jump to the Designation column of the last empty row.
 */
export function useGlobalKeyboard() {
  const scanBufferRef = useRef<string>('');
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanStartRef = useRef<number>(0);

  useEffect(() => {
    // ------------------------------------------------------------------
    // Helpers – direct reads from Zustand (no React re-render needed)
    // ------------------------------------------------------------------
    const store = useNavigationStore;

    const getState = () => store.getState();

    // ------------------------------------------------------------------
    // Scanner buffer helpers
    // ------------------------------------------------------------------
    function flushScanBuffer() {
      const buf = scanBufferRef.current;
      const elapsed = Date.now() - scanStartRef.current;

      if (buf.length >= MIN_SCANNER_LENGTH && elapsed <= SCANNER_WINDOW_MS) {
        // Fast burst → scanner input
        window.dispatchEvent(
          new CustomEvent('scanner-input', { detail: { code: buf } }),
        );
      }
      // Reset buffer regardless
      scanBufferRef.current = '';
      scanStartRef.current = 0;
    }

    function appendToScanBuffer(char: string) {
      const now = Date.now();
      if (scanBufferRef.current.length === 0) {
        scanStartRef.current = now;
      }
      scanBufferRef.current += char;

      // Reset debounce timer
      if (scanTimerRef.current !== null) {
        clearTimeout(scanTimerRef.current);
      }
      scanTimerRef.current = setTimeout(flushScanBuffer, SCANNER_DEBOUNCE_MS);
    }

    // ------------------------------------------------------------------
    // Keydown handler
    // ------------------------------------------------------------------
    function handleKeyDown(e: KeyboardEvent) {
      const state = getState();

      // 1. Any key press → switch to keyboard input method
      if (state.inputMethod !== 'keyboard') {
        store.setState({ inputMethod: 'keyboard' });
      }

      // Ignore when no cell is active (module-level navigation can handle
      // this separately).
      if (!state.activeCell) return;

      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // ---------------------------------------------------------------
      // Scanner fallback – buffer printable single-char keys
      // ---------------------------------------------------------------
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        appendToScanBuffer(e.key);
      }

      // ---------------------------------------------------------------
      // Tab bypass – jump to last empty row (Designation column)
      // ---------------------------------------------------------------
      if (e.key === 'Tab') {
        e.preventDefault();
        store.getState().jumpToLastEmptyRow();
        return;
      }

      // ---------------------------------------------------------------
      // Navigation keys (only in hover mode and not inside an input)
      // ---------------------------------------------------------------
      if (state.mode === 'hover' && !isInput) {
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
          case 'Enter': {
            e.preventDefault();
            const col = GRID_COLUMNS[state.activeCell.col];

            // Context-aware Enter -----------------------------------
            if (col === 'total') {
              // Total is read-only → advance to next row
              store.getState().advanceToNextRow();
            } else {
              // All other columns → enter edit mode
              store.getState().setMode('edit');
            }
            return;
          }
          case 'Escape':
            e.preventDefault();
            store.getState().setMode('hover');
            return;
        }
      }

      // ---------------------------------------------------------------
      // While in edit mode
      // ---------------------------------------------------------------
      if (state.mode === 'edit') {
        if (e.key === 'Enter') {
          // Save & return to hover
          e.preventDefault();
          store.getState().setMode('hover');
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          store.getState().setMode('hover');
          return;
        }
      }
    }

    // ------------------------------------------------------------------
    // Mouse handler – "Last Input Wins": any click → mouse mode
    // ------------------------------------------------------------------
    function handleMouseDown() {
      const state = getState();
      if (state.inputMethod !== 'mouse') {
        store.setState({ inputMethod: 'mouse' });
      }
    }

    // ------------------------------------------------------------------
    // Attach / detach
    // ------------------------------------------------------------------
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
