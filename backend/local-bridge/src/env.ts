import path from 'path';
import os from 'os';
import { config } from 'dotenv';

const envPath = process.env.LOCALBRIDGE_ENV || path.resolve(process.cwd(), '.env');
config({ path: envPath, override: true });

// Non-secret: which Supabase project this branch's backend syncs to by
// default. SUPABASE_SERVICE_KEY has no fallback - it's a real secret and
// must come from the environment (never commit it).
const FALLBACK_SUPABASE_URL = 'https://onsqvduklnwffugsiybs.supabase.co';

const numberFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getDefaultDataDir = () => {
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'retail-manager', 'data');
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Retail Manager', 'data');
    }
    return path.join(os.homedir(), '.local', 'share', 'retail-manager', 'data');
};

export const env = {
  port: numberFromEnv(process.env.PORT, 8787),
  dataDir: process.env.DATA_DIR || getDefaultDataDir(),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  supabaseUrl: process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',

  // Crash reporting. Empty means monitoring is off and the bridge behaves
  // exactly as it always has - there is deliberately no fallback DSN in
  // source. Supplied by the Tauri shell when it spawns this sidecar (see
  // src-tauri/src/lib.rs), or from a .env for local development.
  sentryDsn: process.env.SENTRY_DSN || '',
  clientId: process.env.CLIENT_ID || 'unknown',

};
