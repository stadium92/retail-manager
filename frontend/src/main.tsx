import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

console.log('ðŸš€ Bootstrapping Djati...');

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
