import { supabase } from '@/integrations/supabase/client';

export type AppMode = 'cloud' | 'hybrid' | 'offline';

const DEFAULT_MODE: AppMode = 'cloud';

const resolvedMode = (() => {
  const raw = import.meta.env.VITE_APP_MODE as AppMode | undefined;
  if (!raw) return DEFAULT_MODE;
  if (raw === 'cloud' || raw === 'hybrid' || raw === 'offline') {
    return raw;
  }
  console.warn(`Unknown APP_MODE "${raw}". Falling back to "cloud".`);
  return DEFAULT_MODE;
})();

const localBridgeBaseUrl = (import.meta.env.VITE_LOCALBRIDGE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

export interface DataClient {
  mode: AppMode;
  supabase: typeof supabase;
  isLocalFirst: boolean;
  localBridgeBaseUrl: string;
}

export function getDataClient(): DataClient {
  return {
    mode: resolvedMode,
    supabase,
    isLocalFirst: resolvedMode === 'offline' || resolvedMode === 'hybrid',
    localBridgeBaseUrl,
  };
}
