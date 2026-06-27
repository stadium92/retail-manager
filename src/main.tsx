import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: ["localhost"],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

console.log('🚀 Bootstrapping Djati...');

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

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <App />
  </ThemeProvider>
);
