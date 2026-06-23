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
        return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'retail-manager-stihl', 'data');
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Retail Manager Stihl', 'data');
    }
    return path.join(os.homedir(), '.local', 'share', 'retail-manager-stihl', 'data');
};

export const env = {
  port: numberFromEnv(process.env.PORT, 8787),
  dataDir: process.env.DATA_DIR || getDefaultDataDir(),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://fpvrbxmbrotowdlyebqv.supabase.co',
  supabaseAnonKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwdnJieG1icm90b3dkbHllYnF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzE1MjMsImV4cCI6MjA5NjY0NzUyM30.8_mjBGr1FpYE20cc22iehEf0Xi9Fix2M0d_SSHIDQuI',
};
