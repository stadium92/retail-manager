import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

console.log('ðŸš€ Bootstrapping Djati...');

// Suppress ResizeObserver loop warning overlays in development
if (typeof window !== 'undefined') {
  const resizeObserverErr = 'ResizeObserver loop completed with undelivered notifications';
  const resizeObserverErrLimit = 'ResizeObserver loop limit exceeded';
  
  const isResizeObserverError = (msg: string) => {
    return msg && (msg.includes(resizeObserverErr) || msg.includes(resizeObserverErrLimit));
  };

  // 1. window.onerror
  const oldOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msgStr = typeof message === 'string' ? message : message?.toString() || '';
    if (isResizeObserverError(msgStr)) {
      return true; // prevents firing default handler
    }
    if (oldOnError) {
      return oldOnError.apply(this, arguments as any);
    }
  };

  // 2. window.addEventListener('error')
  window.addEventListener('error', (e) => {
    if (e.message && isResizeObserverError(e.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });

  // 3. window.addEventListener('unhandledrejection')
  window.addEventListener('unhandledrejection', (e) => {
    const reasonStr = e.reason?.message || e.reason?.toString() || '';
    if (isResizeObserverError(reasonStr)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

// Emergency: Wipe browser storage once to clear corrupt data
try {
  const hasResetSession = sessionStorage.getItem('system_reset_v2_done');
  const hasResetLocal = localStorage.getItem('system_reset_v2');

  if (!hasResetLocal && !hasResetSession) {
    console.log('System reset requested: Clearing browser storage...');
    sessionStorage.setItem('system_reset_v2_done', 'true');
    
    localStorage.clear();
    localStorage.setItem('system_reset_v2', 'true');
    
    // Clear all IndexedDB databases safely if supported
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      }).catch(err => {
        console.warn('Failed to list or delete IndexedDB databases:', err);
      });
    }
    
    window.location.reload();
  }
} catch (e) {
  console.error('Failed to clear browser storage on startup:', e);
}


createRoot(document.getElementById("root")!).render(<App />);
