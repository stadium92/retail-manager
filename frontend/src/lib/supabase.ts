import { createClient } from '@supabase/supabase-js';

// Fallback credentials to ensure the compiled Tauri desktop app connects to the correct Supabase instance out-of-the-box
export const FALLBACK_SUPABASE_URL = "https://vznjhmlzrmxgzggjcutk.supabase.co";
export const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bmpobWx6cm14Z3pnZ2pjdXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MjU0ODQsImV4cCI6MjA3ODAwMTQ4NH0.vQwEbq6BrUTyaKdp5mRxNuuCEfaboCIyhS7YbrOZq14";

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
