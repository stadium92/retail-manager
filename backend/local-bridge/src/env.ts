import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { config } from 'dotenv';

const envPath = process.env.LOCALBRIDGE_ENV || path.resolve(process.cwd(), '.env');
config({ path: envPath, override: true });

const numberFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getDefaultDataDir = () => {
    if (process.platform === 'win32') {
        // Primary: Tauri v2 app data dir for Dibidani bundle identifier
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, 'com.retailmanager.dibidani', 'data');
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'com.retailmanager.dibidani', 'data');
    }
    return path.join(os.homedir(), '.local', 'share', 'com.retailmanager.dibidani', 'data');
};

const resolvedDataDir = process.env.DATA_DIR || getDefaultDataDir();

// Log resolved configuration at startup for diagnostic purposes
console.log('[ENV] Platform:', process.platform);
console.log('[ENV] DATA_DIR env var:', process.env.DATA_DIR || '(not set - using default)');
console.log('[ENV] Resolved dataDir:', resolvedDataDir);
console.log('[ENV] PORT env var:', process.env.PORT || '(not set - using default 8787)');

/**
 * Generate or load a stable per-machine JWT secret.
 * Stored in <dataDir>/jwt-secret.key. On first run, a random 32-byte hex
 * key is generated and persisted. All subsequent launches read the same key,
 * so JWT tokens survive app restarts without needing JWT_SECRET env var.
 *
 * If JWT_SECRET env var IS set (e.g. by Tauri), it takes priority so that
 * intentional key rotation is still possible.
 */
const getStableJwtSecret = (): string => {
  if (process.env.JWT_SECRET) {
    console.log('[ENV] Using JWT_SECRET from environment variable.');
    return process.env.JWT_SECRET;
  }

  const secretFile = path.join(resolvedDataDir, 'jwt-secret.key');

  try {
    // Ensure the data directory exists before reading/writing
    if (!fs.existsSync(resolvedDataDir)) {
      fs.mkdirSync(resolvedDataDir, { recursive: true });
    }

    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing && existing.length >= 32) {
        console.log('[ENV] JWT secret loaded from disk (stable per-machine key).');
        return existing;
      }
    }

    // Generate a new random 32-byte hex key
    const newSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, newSecret, { mode: 0o600 });
    console.log('[ENV] JWT secret generated and saved to:', secretFile);
    return newSecret;
  } catch (err) {
    console.error('[ENV] Failed to read/write JWT secret file:', err);
    console.warn('[ENV] Falling back to hardcoded dev-secret (sessions will not persist across restarts).');
    return 'dev-secret-fallback-' + os.hostname();
  }
};

export const env = {
  port: numberFromEnv(process.env.PORT, 8787),
  dataDir: resolvedDataDir,
  jwtSecret: getStableJwtSecret(),
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://onsqvduklnwffugsixbs.supabase.co',
  supabaseAnonKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uc3F2ZHVrbG53ZmZ1Z3NpeWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk1MDgsImV4cCI6MjA5NzgxNTUwOH0.39u7eCzwZonAVbxdEYTQBv9cMONWHSCD5SBKeKSmUkE',
};
