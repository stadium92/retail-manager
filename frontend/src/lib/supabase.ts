import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

// Accept either key name for flexibility
const supabaseAnonKey = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
);

if (!supabaseUrl) {
  throw new Error(
    '[supabase.ts] VITE_SUPABASE_URL is not set. Check frontend/.env'
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    '[supabase.ts] Neither VITE_SUPABASE_PUBLISHABLE_KEY nor VITE_SUPABASE_ANON_KEY is set. Check frontend/.env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
