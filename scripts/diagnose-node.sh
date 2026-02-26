#!/bin/bash

echo "========================================"
echo "   RETAIL MANAGER DIAGNOSTIC REPORT"
echo "========================================"
echo "Date: $(date)"
echo ""

echo "--- 1. Node Environment ---"
echo "System Node Version: $(node -v)"
echo "Which Node: $(which node)"
echo "NVM RC file: $(cat Pro/retail-manager/backend/local-bridge/.nvmrc 2>/dev/null || echo 'Not found')"
echo ""

echo "--- 2. Package Managers ---"
echo "NPM Version: $(npm -v)"
echo "PNPM Version: $(pnpm -v 2>/dev/null || echo 'Not installed')"
echo ""

echo "--- 3. Port Usage (5173 - Frontend) ---"
lsof -i :5173 || echo "Port 5173 is free"
echo ""

echo "--- 4. Port Usage (8787 - Backend) ---"
lsof -i :8787 || echo "Port 8787 is free"
echo ""

echo "--- 5. Running Node Processes ---"
ps aux | grep node | grep -v grep | awk '{print $2, $11, $12, $13}' | head -n 10
echo ""

echo "--- 6. Backend Dependency Check ---"
if [ -d "Pro/retail-manager/backend/local-bridge/node_modules" ]; then
  echo "Backend node_modules exists."
  echo "Better-SQLite3 binary check:"
  find Pro/retail-manager/backend/local-bridge/node_modules -name "better_sqlite3.node"
else
  echo "⚠️  Backend node_modules NOT found!"
fi

echo ""
echo "========================================"
echo "   END REPORT"
echo "========================================"
