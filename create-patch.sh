#!/bin/bash

# Retail Manager Patch Creation Script
# Usage: ./create-patch.sh <version>
# Example: ./create-patch.sh 1.0.1

set -e

if [ -z "$1" ]; then
  echo "Usage: ./create-patch.sh <version>"
  echo "Example: ./create-patch.sh 1.0.1"
  exit 1
fi

VERSION="$1"
PATCH_DIR="patch-v${VERSION}"
PATCH_FILE="patch-v${VERSION}.zip"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Creating Patch v${VERSION} ===${NC}"

# Clean up old patch files
if [ -d "$PATCH_DIR" ]; then
  echo -e "${YELLOW}Cleaning up old patch directory...${NC}"
  rm -rf "$PATCH_DIR"
fi

if [ -f "$PATCH_FILE" ]; then
  echo -e "${YELLOW}Removing old patch file...${NC}"
  rm "$PATCH_FILE"
fi

# Create patch directory structure
echo -e "${BLUE}Creating patch structure...${NC}"
mkdir -p "$PATCH_DIR/frontend"
mkdir -p "$PATCH_DIR/backend"

# Copy frontend build (must be built first)
echo -e "${BLUE}Copying frontend files...${NC}"
if [ ! -d "frontend/dist" ]; then
  echo -e "${YELLOW}Frontend not built. Building frontend...${NC}"
  cd frontend
  npm run build
  cd ..
fi
cp -r frontend/dist/* "$PATCH_DIR/frontend/" || true

# Copy backend binary
echo -e "${BLUE}Copying backend binary...${NC}"
if [ ! -f "src-tauri/binaries/local-bridge-aarch64-apple-darwin" ]; then
  echo -e "${YELLOW}Backend not built. Building backend...${NC}"
  cd backend/local-bridge
  npm run build
  cd ../..
  
  # Build and package backend
  cd backend/local-bridge
  npm run build:pkg
  cd ../..
fi
cp "src-tauri/binaries/local-bridge-aarch64-apple-darwin" "$PATCH_DIR/backend/local-bridge" || true

# Generate checksums
echo -e "${BLUE}Generating checksums...${NC}"

# Create manifest
FRONTEND_CHECKSUM=""
BACKEND_CHECKSUM=""

if [ -d "$PATCH_DIR/frontend" ] && [ "$(ls -A $PATCH_DIR/frontend)" ]; then
  FRONTEND_CHECKSUM=$(find "$PATCH_DIR/frontend" -type f | sort | xargs sha256sum | sha256sum | awk '{print $1}')
fi

if [ -f "$PATCH_DIR/backend/local-bridge" ]; then
  BACKEND_CHECKSUM=$(sha256sum "$PATCH_DIR/backend/local-bridge" | awk '{print $1}')
fi

# Create manifest.json
cat > "$PATCH_DIR/manifest.json" << EOF
{
  "version": "${VERSION}",
  "date": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "checksums": {
    "manifest.json": "",
    "frontend": "${FRONTEND_CHECKSUM}",
    "backend/local-bridge": "${BACKEND_CHECKSUM}"
  }
}
EOF

# Recalculate manifest checksum and update
MANIFEST_CHECKSUM=$(sha256sum "$PATCH_DIR/manifest.json" | awk '{print $1}')
sed -i '' "s/\"manifest.json\": \"\"/\"manifest.json\": \"${MANIFEST_CHECKSUM}\"/" "$PATCH_DIR/manifest.json"

# Create zip file
echo -e "${BLUE}Creating patch archive...${NC}"
zip -r "$PATCH_FILE" "$PATCH_DIR" > /dev/null

# Calculate final checksums for distribution
echo -e "${BLUE}Finalizing patch...${NC}"
PATCH_CHECKSUM=$(sha256sum "$PATCH_FILE" | awk '{print $1}')

# Clean up directory
rm -rf "$PATCH_DIR"

# Print summary
echo ""
echo -e "${GREEN}=== Patch Created Successfully ===${NC}"
echo -e "${GREEN}Patch File: ${PATCH_FILE}${NC}"
echo -e "${GREEN}Patch Size: $(du -h "$PATCH_FILE" | awk '{print $1}')${NC}"
echo -e "${GREEN}Checksum: ${PATCH_CHECKSUM}${NC}"
echo ""
echo "Next steps:"
echo "1. Send '$PATCH_FILE' to your client"
echo "2. Client opens the app and goes to Settings > Updates & Patches"
echo "3. Client selects the patch file and clicks 'Browse Files...'"
echo "4. App automatically installs and restarts"
echo ""
echo "Distribution Info:"
echo "  File: $PATCH_FILE"
echo "  Checksum (SHA256): $PATCH_CHECKSUM"
