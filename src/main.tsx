import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

console.log('ðŸš€ Bootstrapping Djati...');

// Suppress ResizeObserver loop warning overlays in development
if (typeof window !== 'undefined') {
  const resizeObserverErr = 'ResizeObserver loop completed with undelivered notifications';
  const resizeObserverErrLimit = 'ResizeObserver loop limit exceeded';
  
  window.addEventListener('error', (e) => {
    if (e.message && (e.message.includes(resizeObserverErr) || e.message.includes(resizeObserverErrLimit))) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

// Emergency: Wipe browser storage once to clear corrupt data
if (!localStorage.getItem('system_reset_v2')) {
  console.log('System reset requested: Clearing browser storage...');
  localStorage.clear();
  // Clear all IndexedDB databases
  indexedDB.databases().then(databases => {
    databases.forEach(db => {
      if (db.name) indexedDB.deleteDatabase(db.name);
    });
  });
  localStorage.setItem('system_reset_v2', 'true');
  window.location.reload();
}

createRoot(document.getElementById("root")!).render(<App />);
