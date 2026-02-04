# Native Module Build Issues with Tauri + pkg + better-sqlite3

## Problem Overview

When building a Tauri v2 macOS application with a Node.js backend sidecar packaged using `pkg`, the application fails to start due to native module loading errors with `better-sqlite3`.

### Error Symptoms

1. **Initial Error**: Backend sidecar crashes immediately on startup
2. **Error Message**: `ERR_DLOPEN_FAILED`
3. **Root Cause**: Node module version mismatch between the compiled native module and the pkg-bundled Node.js runtime

### Complete Error Stack Trace

```
Error: The module '/path/to/retail-manager.app/Contents/Resources/binaries/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 115. This version of Node.js requires
NODE_MODULE_VERSION 108. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
```

## Root Cause Analysis

### The Version Mismatch Problem

1. **System Node.js**: v20.17.0 (NODE_MODULE_VERSION 115)
2. **pkg Node.js**: v18.5.0 (NODE_MODULE_VERSION 108)
3. **Native Module Compilation**: By default, `npm install` compiles native modules against the **current** Node.js version (v20)
4. **Runtime Execution**: `pkg` bundles Node.js v18.5.0, which cannot load modules compiled for Node v20

### Why This Happens

- `pkg` version 5.8.1 only supports Node.js up to v18
- `better-sqlite3` is a native C++ addon that must be compiled for the **exact** Node.js version it will run on
- The `NODE_MODULE_VERSION` is an ABI (Application Binary Interface) version that changes between Node.js versions
- Mismatched versions result in immediate crashes when trying to load the `.node` file

### Additional Complexity: pkg's Virtual Filesystem

`pkg` creates a virtual filesystem at `/snapshot/` for bundled JavaScript files. Native modules (`.node` files) **cannot** be embedded in this virtual filesystem and must be:
1. Placed as external files in the app bundle
2. Loaded using absolute paths from the real filesystem

## Complete Solution

### Step 1: Rebuild Native Module for Correct Node Version

Navigate to the better-sqlite3 module directory and rebuild it specifically for Node.js v18.5.0:

```bash
cd backend/local-bridge/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3
rm -rf build
npx node-gyp rebuild --target=18.5.0 --dist-url=https://nodejs.org/dist
```

**Important Notes**:
- Use the **exact** Node.js version that pkg bundles (18.5.0)
- The rebuild must complete successfully (ends with "gyp info ok")
- This creates `build/Release/better_sqlite3.node` compiled for Node v18

### Step 2: Update Build Script

Modify `package.json` to copy the correctly compiled native module:

```json
{
  "scripts": {
    "build:backend": "cd backend/local-bridge && rm -rf dist && npx tsc -p tsconfig.build.json && npx pkg dist/index.js -t node18-macos-arm64 -o ../../src-tauri/binaries/local-bridge-aarch64-apple-darwin && cp node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3/build/Release/better_sqlite3.node ../../src-tauri/binaries/ && codesign --sign - --force --preserve-metadata=entitlements,requirements,flags,runtime ../../src-tauri/binaries/local-bridge-aarch64-apple-darwin"
  }
}
```

**Key Changes**:
- Copy from the **pnpm** path: `node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3/build/Release/`
- Not from the shortcut path: `node_modules/better-sqlite3/build/Release/`

### Step 3: Configure Native Module Loading in Code

Update `backend/local-bridge/src/db.ts` to specify the native module path when running in pkg:

```typescript
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { env } from './env.js';

// ... interfaces ...

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
            console.error('[DB] ERROR: Could not find better_sqlite3.node in:', resourcePath, 'or', adjacentPath);
            // List what's actually in the directories for debugging
            try {
              const macosDir = path.resolve(execDir);
              const resourcesDir = path.resolve(execDir, '../Resources/binaries');
              console.error('[DB] Contents of MacOS dir:', fs.existsSync(macosDir) ? fs.readdirSync(macosDir) : 'DOES NOT EXIST');
              console.error('[DB] Contents of Resources/binaries:', fs.existsSync(resourcesDir) ? fs.readdirSync(resourcesDir) : 'DOES NOT EXIST');
            } catch (e) {
              console.error('[DB] Error listing directories:', e);
            }
        }
    }
    
    this.db = new Database(this.dbPath, options);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
    this.migrate();
  }
  
  // ... rest of the class ...
}
```

**Key Points**:
- Check for `process.pkg` to detect when running in packaged mode
- Use `nativeBinding` option to specify the absolute path to the `.node` file
- Fall back to multiple possible locations for flexibility
- Add detailed logging for debugging

### Step 4: Ensure Tauri Configuration

Verify `src-tauri/tauri.conf.json` includes the native module as a resource:

```json
{
  "bundle": {
    "resources": [
      "binaries/better_sqlite3.node"
    ],
    "externalBin": [
      "binaries/local-bridge"
    ]
  }
}
```

This ensures the `.node` file is copied to `Contents/Resources/binaries/` in the macOS app bundle.

## Build Process

### Complete Build Commands

```bash
# 1. Rebuild native module for Node 18.5.0
cd backend/local-bridge/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3
rm -rf build
npx node-gyp rebuild --target=18.5.0 --dist-url=https://nodejs.org/dist
cd ../../../../../..

# 2. Build backend sidecar
pnpm run build:backend

# 3. Build Tauri app
pnpm exec tauri build

# 4. Copy to release folder (optional)
rm -rf release/retail-manager.app
cp -R src-tauri/target/release/bundle/macos/retail-manager.app release/
```

### Verification After Build

Check that all components are in place:

```bash
# Check sidecar binary
ls -lh release/retail-manager.app/Contents/MacOS/local-bridge

# Check native module
ls -lh release/retail-manager.app/Contents/Resources/binaries/better_sqlite3.node

# Check native module version (should show Node v18)
file release/retail-manager.app/Contents/Resources/binaries/better_sqlite3.node
```

## Testing

### Launch and Check Logs

```bash
# Open the app
open release/retail-manager.app

# Wait a few seconds, then check logs
tail -f ~/Library/Logs/com.retailmanager.app/retail-manager.log

# Look for successful backend startup:
# [DB] Using native module from: /path/to/better_sqlite3.node
# Server listening on port 5040

# Check if backend process is running
ps aux | grep local-bridge | grep -v grep

# Check backend log file
tail -f ~/Library/Application\ Support/retail-manager/backend.log
```

### Expected Success Indicators

1. ✅ No `ERR_DLOPEN_FAILED` errors in logs
2. ✅ Backend process appears in `ps aux` output
3. ✅ `backend.log` file is created with server startup messages
4. ✅ App UI can connect to backend and create accounts

## Common Issues and Solutions

### Issue 1: "No available node version satisfies 'node20'"

**Problem**: Trying to use `pkg -t node20-macos-arm64`
**Solution**: Use `node18-macos-arm64` - pkg 5.8.1 only supports up to Node 18

### Issue 2: "EEXIST: file already exists" during npm rebuild

**Problem**: Leftover symlinks in build directory
**Solution**: 
```bash
rm -rf node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build
npm rebuild better-sqlite3
```

### Issue 3: Native module still shows NODE_MODULE_VERSION 115

**Problem**: Module not rebuilt or copied from wrong location
**Solution**: 
1. Verify rebuild completed: `ls -l backend/local-bridge/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3/build/Release/`
2. Check build script copies from correct path
3. Rebuild backend: `pnpm run build:backend`

### Issue 4: "Could not find better_sqlite3.node" at runtime

**Problem**: Native module not copied to app bundle
**Solution**:
1. Check `tauri.conf.json` has `"resources": ["binaries/better_sqlite3.node"]`
2. Rebuild: `pnpm exec tauri build`
3. Verify: `ls -l src-tauri/target/release/bundle/macos/retail-manager.app/Contents/Resources/binaries/`

## Technical Reference

### Node.js MODULE_VERSION Numbers

| Node Version | MODULE_VERSION |
|--------------|----------------|
| 16.x         | 93             |
| 18.x         | 108            |
| 20.x         | 115            |
| 22.x         | 127            |

### pkg Supported Node Versions (v5.8.1)

- node14
- node16
- node18
- ❌ node20 (not supported)

### macOS App Bundle Structure

```
retail-manager.app/
├── Contents/
│   ├── MacOS/
│   │   ├── app                    # Tauri/Rust main executable
│   │   └── local-bridge           # Node.js sidecar (pkg-bundled)
│   └── Resources/
│       ├── binaries/
│       │   └── better_sqlite3.node # Native SQLite module
│       └── icon.icns
```

## Alternative Approaches (Not Recommended)

### Option A: Use Node 18 System-Wide

```bash
nvm install 18.5.0
nvm use 18.5.0
cd backend/local-bridge
npm install
```

**Pros**: Automatic version match
**Cons**: Requires downgrading system Node, affects all projects

### Option B: Use Different Packaging Tool

- **nexe**: Similar to pkg, may have same issues
- **@yao-pkg/pkg**: Updated fork with Node 20 support
- **esbuild + Node binary**: More control, more complex setup

### Option C: Use Pure SQLite Without Native Bindings

- **sql.js**: WebAssembly SQLite, slower but no native deps
- **@electric-sql/pglite**: PostgreSQL in WASM

## Future Improvements

1. **Automate Native Module Rebuild**: Add pre-build script
   ```json
   {
     "scripts": {
       "prebuild:backend": "cd backend/local-bridge/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3 && rm -rf build && npx node-gyp rebuild --target=18.5.0 --dist-url=https://nodejs.org/dist"
     }
   }
   ```

2. **Version Check Script**: Verify native module matches pkg Node version

3. **Upgrade pkg**: Monitor for newer versions with Node 20+ support

4. **Switch to Alternative**: Consider `@yao-pkg/pkg` for Node 20

## Resources

- [pkg Documentation](https://github.com/vercel/pkg)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [node-gyp Documentation](https://github.com/nodejs/node-gyp)
- [Tauri Sidecar Guide](https://tauri.app/v1/guides/building/sidecar)
- [Node.js ABI Version Registry](https://github.com/lgeiger/node-abi)

## Summary

The core issue is a **Node.js version mismatch** between:
- Development environment (Node v20)
- Production runtime via pkg (Node v18)

**Solution**: Explicitly rebuild native modules for Node v18.5.0 before packaging, and configure the app to load them from the correct filesystem location.

This ensures binary compatibility between the compiled native module and the pkg-bundled Node.js runtime.
