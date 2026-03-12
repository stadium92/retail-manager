#!/bin/bash
set -e # Exit on error

# Configuration
BACKEND_DIR="backend/local-bridge"
TAURI_BIN_DIR="src-tauri/binaries"
NODE_TARGET="18.5.0" # Target for pkg (node18-macos-arm64)
NODE_ARCH="arm64"

echo "🚀 Starting Backend Sidecar Build..."

# 1. Setup Directories
mkdir -p "$TAURI_BIN_DIR"

# 2. Go to Backend
cd "$BACKEND_DIR"
echo "📂 Working directory: $(pwd)"

# 3. Clean Install (Optional but safer for prod builds)
# echo "🧹 Cleaning previous builds..."
# rm -rf dist node_modules
# pnpm install

# 4. Rebuild Native Module for Target Node Version (Node 18 for pkg)
echo "🔧 Recompiling better-sqlite3 for Node $NODE_TARGET ($NODE_ARCH)..."

# Locate the actual module path (npm structure)
BETTER_SQLITE_PATH="node_modules/better-sqlite3"

if [ ! -d "$BETTER_SQLITE_PATH" ]; then
  # Fallback for pnpm structure
  BETTER_SQLITE_PATH=$(find node_modules/.pnpm -name "better-sqlite3" -type d | grep "better-sqlite3@12.6.2" | head -n 1)
fi

if [ -z "$BETTER_SQLITE_PATH" ] || [ ! -d "$BETTER_SQLITE_PATH" ]; then
  echo "❌ Error: Could not find better-sqlite3 in node_modules"
  exit 1
fi

echo "📍 Found module at: $BETTER_SQLITE_PATH"

# Go into the module and rebuild it manually using node-gyp
cd "$BETTER_SQLITE_PATH"
# Clean previous build
rm -rf build
# Rebuild using local node-gyp but targetting specific version
npx node-gyp rebuild --target=$NODE_TARGET --target_arch=$NODE_ARCH --dist-url=https://nodejs.org/dist

# Verify the file exists
BINARY_SOURCE="build/Release/better_sqlite3.node"
if [ ! -f "$BINARY_SOURCE" ]; then
  echo "❌ Error: Native module build failed. File not found at $BINARY_SOURCE"
  exit 1
fi

# Copy the Node 18 compatible binary to Tauri resources
echo "📦 Copying native binary to Tauri resources..."
cp "$BINARY_SOURCE" "../../../../$TAURI_BIN_DIR/better_sqlite3.node"

# 5. Build the Node.js App (TypeScript -> JS)
echo "🔨 Compiling TypeScript (Skipping Obfuscation for Debug)..."
cd ../.. # Back to local-bridge root (from node_modules/better-sqlite3)
pwd # Verify we are in backend/local-bridge
# npm run build # Skips obfuscation to fix pkg issue
npx tsc -p tsconfig.json

# 6. Package with pkg
echo "📦 Packaging sidecar executable..."
# We use the config in package.json now to ensure assets are included correctly
npx pkg . --compress GZip

# 7. Code Signing (Ad-hoc)
echo "🔏 Signing binary..."
# Move/Rename the output to match Tauri's expectation
# We name it without extension in the script, then pkg adds it or we move it
# For Mac arm64: local-bridge-aarch64-apple-darwin
mv "../../src-tauri/binaries/local-bridge" "../../src-tauri/binaries/local-bridge-aarch64-apple-darwin"

codesign --sign - --force --preserve-metadata=entitlements,requirements,flags,runtime "../../src-tauri/binaries/local-bridge-aarch64-apple-darwin"

echo "✅ Sidecar build complete!"
echo "⚠️  NOTE: Your local 'better-sqlite3' is now compiled for Node 18."
echo "⚠️  Run 'pnpm rebuild' in backend/local-bridge to restore it for local dev (Node 20)."
