import path from 'path';
import os from 'os';
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

export const env = {
  port: numberFromEnv(process.env.PORT, 8787),
  dataDir: resolvedDataDir,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://onsqvduklnwffugsixbs.supabase.co',
  supabaseAnonKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uc3F2ZHVrbG53ZmZ1Z3NpeWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk1MDgsImV4cCI6MjA5NzgxNTUwOH0.39u7eCzwZonAVbxdEYTQBv9cMONWHSCD5SBKeKSmUkE',
};
