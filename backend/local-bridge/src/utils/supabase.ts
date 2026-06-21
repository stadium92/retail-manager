import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { env } from '../env.js';

if (!env.supabaseUrl) {
  throw new Error('[supabase.ts] env.supabaseUrl is not set.');
}
if (!env.supabaseAnonKey) {
  throw new Error('[supabase.ts] env.supabaseAnonKey is not set.');
}

// Inject WebSocket into global scope for Supabase Realtime in Node.js environment
(global as any).WebSocket = WebSocket;

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
