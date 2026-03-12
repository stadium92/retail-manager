import { supabase } from '@/integrations/supabase/client';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

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
  const isLocalFirst = resolvedMode === 'offline' || resolvedMode === 'hybrid';
  console.log(`ðŸ” [DataClient] mode: ${resolvedMode}, isLocalFirst: ${isLocalFirst}, baseUrl: ${localBridgeBaseUrl}`);
  return {
    mode: resolvedMode,
    supabase,
    isLocalFirst,
    localBridgeBaseUrl,
  };
}

const isTauri = typeof window !== 'undefined' && (
  (window as any).__TAURI_INTERNALS__ !== undefined || 
  (window as any).__TAURI__ !== undefined ||
  navigator.userAgent.includes('Tauri')
);

export const smartFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let urlStr = input.toString();
  
  // Standardize localhost to 127.0.0.1 for local bridge requests
  if (urlStr.includes('localhost:8787')) {
    urlStr = urlStr.replace('localhost:8787', '127.0.0.1:8787');
  }

  const isLocal = urlStr.startsWith(localBridgeBaseUrl) || 
                  urlStr.includes('127.0.0.1:8787');

  console.log(`ðŸ” [smartFetch] input: ${urlStr}, isLocal: ${isLocal}, isTauri: ${isTauri}, isPROD: ${import.meta.env.PROD}`);

  // Only use Tauri's specialized fetch if we are actually running inside Tauri
  // In Production build, we assume we want the Tauri plugin for local bridge requests
  if (isLocal && (isTauri || import.meta.env.PROD)) {
    console.log('ðŸ” [smartFetch] Routing via Tauri HTTP Plugin');
    try {
      // Cast init to any because Tauri's FetchOptions might slightly differ from standard RequestInit
      // but they are compatible for standard usages.
      console.log('ðŸ” [smartFetch] Attempting Tauri Plugin Fetch...');
      const response = await tauriFetch(urlStr, init as any);
      console.log('ðŸ” [smartFetch] Tauri Plugin Fetch Success:', response.status);
      return response;
    } catch (e) {
      console.error('ðŸš« [smartFetch] Tauri Fetch Plugin CRASHED:', e);
      console.log('ðŸ” [smartFetch] FALLING BACK to standard fetch...');
      return fetch(urlStr, init);
    }
  }
  
  if (isLocal) {
    console.log('ðŸ” [smartFetch] Local request but NOT in Tauri. Using standard fetch.');
  }
  
  return fetch(urlStr, init);
};
