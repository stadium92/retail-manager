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
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Retail Manager', 'data');
    }
    return path.join(os.homedir(), '.local', 'share', 'retail-manager', 'data');
};

export const env = {
  port: numberFromEnv(process.env.PORT, 8787),
  dataDir: process.env.DATA_DIR || getDefaultDataDir(),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',

};
