import { createClient } from '@supabase/supabase-js';

export const FALLBACK_SUPABASE_URL = "https://kvxqutffphaxlhjyyjsw.supabase.co";
export const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eHF1dGZmcGhheGxoanl5anN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5Nzg3MjksImV4cCI6MjA5NjU1NDcyOX0.Ag6hB8LIXTrYHTcmSgDMoItU13Ql59JRXQvrwpI5v7c";



const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_SUPABASE_URL;

// Accept either key name for flexibility
const supabaseAnonKey = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  FALLBACK_SUPABASE_ANON_KEY
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
