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

  // Hard timeout for requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  const fetchInit = {
    ...init,
    signal: controller.signal,
  };

  console.log(`ðŸ” [smartFetch] START: ${urlStr} (Local: ${isLocal}, Tauri: ${isTauri})`);

  try {
    let response: Response;

    // Only use Tauri's specialized fetch if we are actually running inside Tauri
    if (isLocal && (isTauri || import.meta.env.PROD)) {
      try {
        console.log('ðŸ” [smartFetch] Routing via Tauri HTTP Plugin...');
        // Cast to any for plugin-specific options if needed
        response = await tauriFetch(urlStr, fetchInit as any);
        console.log(`ðŸ” [smartFetch] Tauri Plugin SUCCESS: ${response.status} (${urlStr})`);
      } catch (e) {
        console.error('ðŸš« [smartFetch] Tauri Fetch Plugin FAILED:', e);
        console.log('ðŸ” [smartFetch] Falling back to standard browser fetch...');
        response = await fetch(urlStr, fetchInit);
      }
    } else {
      response = await fetch(urlStr, fetchInit);
    }

    clearTimeout(timeoutId);
    console.log(`ðŸ” [smartFetch] DONE: ${response.status} (${urlStr})`);
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`ðŸš« [smartFetch] TIMEOUT EXCEEDED: ${urlStr}`);
    } else {
      console.error(`ðŸš« [smartFetch] NETWORK ERROR: ${urlStr}`, err);
    }
    throw err;
  }
};
