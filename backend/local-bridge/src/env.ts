import path from 'path';
import { config } from 'dotenv';

const envPath = process.env.LOCALBRIDGE_ENV || path.resolve(process.cwd(), '.env');
config({ path: envPath, override: true });

const numberFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  port: numberFromEnv(process.env.PORT, 8787),
  dataDir: process.env.DATA_DIR || path.resolve(process.cwd(), 'data'),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',

};
