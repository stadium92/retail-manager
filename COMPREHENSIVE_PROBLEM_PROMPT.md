# Comprehensive Problem Prompt: Tauri App Backend Sidecar Not Starting

I'm building a macOS desktop application using Tauri v2 with a Node.js backend sidecar, and I'm experiencing critical issues where the backend fails to start after building the app. Here's the complete context:

## Project Architecture

- **Frontend**: Tauri v2 app (Rust + WebView)
- **Backend**: Node.js server packaged as a sidecar using `pkg` (vercel/pkg v5.8.1)
- **Database**: SQLite via `better-sqlite3` (v12.6.2) - a native C++ Node.js addon
- **Platform**: macOS (Apple Silicon, arm64)
- **Development Node Version**: v20.17.0
- **pkg Target**: node18-macos-arm64 (Node v18.5.0)

## The Problem

When I build and launch the Tauri app, the backend sidecar crashes immediately on startup. The app UI loads but cannot connect to the backend, making it completely non-functional (can't sign in, can't create accounts, no data access).

### Complete Error Logs

From `~/Library/Logs/com.retailmanager.app/retail-manager.log`:

```
[2026-02-04][17:09:34][tauri_plugin_shell::process][DEBUG] Creating sidecar /Users/mohamedcoulibaly/MVP/Pro/retail-manager/release/retail-manager.app/Contents/MacOS/local-bridge
[2026-02-04][17:09:34][app_lib][INFO] Tauri core initialized and sidecar spawn attempted.
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: pkg/prelude/bootstrap.js:1872
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: throw error;
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: ^
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: 
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: Error: The module '/Users/mohamedcoulibaly/MVP/Pro/retail-manager/release/retail-manager.app/Contents/Resources/binaries/better_sqlite3.node'
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: was compiled against a different Node.js version using
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: NODE_MODULE_VERSION 115. This version of Node.js requires
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: NODE_MODULE_VERSION 108. Please try re-compiling or re-installing
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: the module (for instance, using `npm rebuild` or `npm install`).
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at process.dlopen (pkg/prelude/bootstrap.js:2251:28)
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at Module._extensions..node (node:internal/modules/cjs/loader:1196:18)
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at Module.load (node:internal/modules/cjs/loader:988:32)
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at Module._load (node:internal/modules/cjs/loader:834:12)
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at Module.require (node:internal/modules/cjs/loader:1012:19)
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at Module.require (pkg/prelude/bootstrap.js:1851:31)
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at require (node:internal/modules/cjs/helpers:102:18)
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at new Database (/snapshot/local-bridge/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3/lib/database.js:52:11)
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at new LocalBridgeDatabase (/snapshot/local-bridge/dist/db.js)
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: at Object.<anonymous> (/snapshot/local-bridge/dist/db.js) {
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: code: 'ERR_DLOPEN_FAILED'
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: }
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: 
[2026-02-04][17:09:35][app_lib][ERROR] Sidecar Error: Node.js v18.5.0
[2026-02-04][17:09:35][app_lib][WARN] Sidecar terminated with exit code: Some(1)
```

### Process Check Results

```bash
# No backend process running
$ ps aux | grep local-bridge | grep -v grep
# (no output - process not found)

# No backend log file created
$ tail ~/Library/Application\ Support/retail-manager/backend.log
# No backend log found
```

## What I Understand About the Problem

1. **NODE_MODULE_VERSION mismatch**: 
   - The error shows `NODE_MODULE_VERSION 115` (compiled for Node v20.x)
   - But pkg is using `NODE_MODULE_VERSION 108` (Node v18.5.0)
   - Native modules MUST match the exact Node version they run on

2. **Native module issue**: `better-sqlite3` is a native C++ addon (`.node` file) that gets compiled during `npm install`, and by default it compiles for the current system Node version (v20.17.0)

3. **pkg limitation**: `pkg` v5.8.1 only supports up to Node 18, doesn't support Node 20

4. **Virtual filesystem**: pkg bundles JavaScript into a virtual `/snapshot/` filesystem, but native `.node` files must be external

## Project Structure

```
retail-manager/
├── package.json (root build scripts)
├── backend/
│   └── local-bridge/
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── db.ts (imports better-sqlite3)
│       │   └── env.ts
│       ├── dist/ (compiled JS)
│       └── node_modules/
│           └── .pnpm/
│               └── better-sqlite3@12.6.2/
│                   └── node_modules/
│                       └── better-sqlite3/
│                           └── build/Release/better_sqlite3.node
├── src-tauri/
│   ├── tauri.conf.json
│   ├── src/lib.rs (spawns sidecar)
│   ├── binaries/
│   │   ├── local-bridge-aarch64-apple-darwin (pkg output)
│   │   └── better_sqlite3.node (copied)
│   └── target/release/bundle/macos/retail-manager.app/
│       └── Contents/
│           ├── MacOS/
│           │   ├── app (Tauri binary)
│           │   └── local-bridge (sidecar - 67MB)
│           └── Resources/
│               └── binaries/
│                   └── better_sqlite3.node (1.9MB)
└── release/
    └── retail-manager.app (final copy)
```

## Current Build Scripts

**Root `package.json`:**
```json
{
  "scripts": {
    "build:backend": "cd backend/local-bridge && rm -rf dist && npx tsc -p tsconfig.build.json && npx pkg dist/index.js -t node18-macos-arm64 -o ../../src-tauri/binaries/local-bridge-aarch64-apple-darwin && cp node_modules/better-sqlite3/build/Release/better_sqlite3.node ../../src-tauri/binaries/ && codesign --sign - --force --preserve-metadata=entitlements,requirements,flags,runtime ../../src-tauri/binaries/local-bridge-aarch64-apple-darwin",
    "tauri:build": "npm run build:backend && tauri build && mkdir -p release && cp -R src-tauri/target/release/bundle/macos/*.app release/ && cp -R src-tauri/target/release/bundle/dmg/*.dmg release/"
  }
}
```

**Backend `package.json`:**
```json
{
  "name": "local-bridge",
  "dependencies": {
    "better-sqlite3": "^12.6.2",
    "fastify": "^4.29.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.3"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "pkg": "^5.8.1",
    "typescript": "^5.8.3"
  }
}
```

**Tauri `tauri.conf.json`:**
```json
{
  "bundle": {
    "identifier": "com.retailmanager.app",
    "resources": [
      "binaries/better_sqlite3.node"
    ],
    "externalBin": [
      "binaries/local-bridge"
    ]
  }
}
```

## Current Database Code

**`backend/local-bridge/src/db.ts`** (relevant parts):
```typescript
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { env } from './env.js';

class LocalBridgeDatabase {
  private readonly dbPath: string;
  private readonly db: Database.Database;

  constructor() {
    if (!fs.existsSync(env.dataDir)) {
      fs.mkdirSync(env.dataDir, { recursive: true });
    }

    this.dbPath = path.join(env.dataDir, 'localbridge.sqlite');
    
    // Handle pkg-packaged environment: specify native module location
    let options: Database.Options = {};
    if ((process as any).pkg) {
        const execDir = path.dirname(process.execPath);
        const resourcePath = path.resolve(execDir, '../Resources/binaries/better_sqlite3.node');
        const adjacentPath = path.join(execDir, 'better_sqlite3.node');

        if (fs.existsSync(resourcePath)) {
            console.log('[DB] Using native module from:', resourcePath);
            options.nativeBinding = resourcePath;
        } else if (fs.existsSync(adjacentPath)) {
            console.log('[DB] Using native module from:', adjacentPath);
            options.nativeBinding = adjacentPath;
        } else {
            console.error('[DB] ERROR: Could not find better_sqlite3.node');
        }
    }
    
    this.db = new Database(this.dbPath, options);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
    this.migrate();
  }
  
  // ... rest of database methods ...
}
```

## What I've Tried

### Attempt 1: Changed pkg target to node20
```json
"build:backend": "... npx pkg ... -t node20-macos-arm64 ..."
```
**Result**: `Error! No available node version satisfies 'node20'` - pkg v5.8.1 doesn't support Node 20

### Attempt 2: Used npm rebuild with --target flag
```bash
npm rebuild better-sqlite3 --target=18.5.0 --target_arch=arm64
```
**Result**: Multiple errors including symlink conflicts and gyp build failures

### Attempt 3: Used @electron/rebuild
```bash
npx @electron/rebuild --version=18.5.0 --module-dir node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3
```
**Result**: Failed with 404 error trying to download Electron headers for v18.5.0

### Attempt 4: Used node-gyp directly (THIS WORKED!)
```bash
cd backend/local-bridge/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3
rm -rf build
npx node-gyp rebuild --target=18.5.0 --dist-url=https://nodejs.org/dist
```
**Result**: ✅ Successfully compiled! Output: `gyp info ok`

## Current Situation

I successfully rebuilt `better-sqlite3` for Node v18.5.0 using the `node-gyp` approach above. The compiled module now exists at:
```
backend/local-bridge/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

However, I notice the build script is trying to copy from:
```
node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

This is the **wrong path** - it should copy from the pnpm path where we just rebuilt it.

## What I Need Help With

Please provide a complete, step-by-step solution that:

1. **Fixes the build script** to copy the native module from the correct pnpm path
2. **Verifies the database code** is correctly configured to load the native module in pkg environment
3. **Provides the complete build sequence** including:
   - Rebuilding the native module for Node 18.5.0
   - Building the backend sidecar
   - Building the Tauri app
   - Verifying all components are in the correct locations
4. **Includes verification commands** to check:
   - The native module is compiled for the correct Node version
   - All files are in the correct locations in the app bundle
   - The backend actually starts and runs
5. **Explains how to test** the built app to confirm everything works

## Additional Context

- I'm using **pnpm** as the package manager, which creates the `.pnpm` directory structure
- The app works fine in development mode (`npm run dev` in backend, `tauri dev` for frontend)
- This is specifically a production build issue with the packaged sidecar
- I need the solution to be reproducible - ideally scriptable so I can rebuild cleanly
- The backend log should appear at `~/Library/Application Support/retail-manager/backend.log` when working
- The backend should listen on port 5040 when running correctly

## Expected Working State

When everything is working correctly:
1. App launches without crashes
2. `ps aux | grep local-bridge` shows a running process
3. Backend log file exists with "Server listening on port 5040"
4. App UI can connect to backend and create accounts
5. No `ERR_DLOPEN_FAILED` errors in Tauri logs

Please provide a comprehensive solution that addresses the Node version mismatch, fixes the build paths, and ensures the native module loads correctly in the packaged pkg environment. Include any gotchas or additional considerations for working with native Node modules in Tauri + pkg + pnpm setups.
