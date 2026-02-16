# Offline Installer Runbook

This runbook describes how to boot Retail Manager in offline-first mode without Supabase Edge Functions.

## Prerequisites
- Node.js 18+
- npm 9+

## LocalBridge (SQLite) setup
1. Install dependencies:
   ```bash
   cd Pro/retail-manager/backend/local-bridge
   npm install
   ```
2. (Optional) Seed demo data:
   ```bash
   npm run seed
   ```
3. Start LocalBridge:
   ```bash
   npm run dev
   ```
   LocalBridge listens on `http://127.0.0.1:8787`.

## Frontend (offline)
1. Install dependencies:
   ```bash
   cd Pro/retail-manager/frontend
   npm install
   ```
2. Ensure offline mode in `.env`:
   ```
   VITE_APP_MODE=offline
   VITE_LOCALBRIDGE_URL=http://127.0.0.1:8787
   VITE_DEV_HTTPS=false
   ```
3. Start the app:
   ```bash
   npm run dev
   ```

## Bootstrap the master user
- On first launch, use **Sign Up** to create the master account locally.
- Use the credentials printed by `npm run seed` if you seeded the database.

## Data location
LocalBridge stores data in `backend/local-bridge/data/localbridge.sqlite` by default.

## Resetting data (local dev only)
Stop LocalBridge and delete:
```
Pro/retail-manager/backend/local-bridge/data/localbridge.sqlite
```
Then restart LocalBridge and bootstrap again.
