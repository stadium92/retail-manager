# Audit Document 3: Deployment & Binaries

## Context
There is a massive distinction in this repository between running the **Development Environment** and running the **Installed Tauri Desktop App**. Failure to distinguish between the two causes endless debugging loops where fixes appear to "not work."

## The Development Environment
- Run via `npm run dev` (Frontend) and `npm start` (Backend Sidecar).
- Code changes in `frontend/src` or `backend/local-bridge` take effect immediately (or upon restart).
- The Local Bridge server listens on `http://localhost:8788`.
- If an AI agent applies a fix and you test it here, the fix will **work**.

## The Installed Tauri App
- Compiled via `npm run tauri:build` into an `.app` or `.dmg`.
- The `local-bridge` backend is compiled into a standalone binary (`dist/index.js` bundled via `pkg` or Tauri sidecar mechanism) and shipped **inside** the `.app` bundle.
- The installed app runs its own embedded binary.
- If an AI agent applies a fix to the source code, **the installed app will NOT see that fix until a new build is explicitly generated (`npm run tauri:build`) and the user installs the new `.dmg`.**

## What Claude Needs to Know
If the user reports that an issue persists after you have confidently fixed the source code, **ask the user how they are testing the app.** 
- If they say "I installed the app" or "I ran the .app file", they are testing a **stale build**.
- Inform the user that source code modifications do not automatically inject themselves into previously installed Desktop binaries. They must run `npm run tauri:build` to produce a new `.dmg` containing the patched backend binary.
