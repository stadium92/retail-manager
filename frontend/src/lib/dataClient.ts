import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export type AppMode = 'cloud' | 'hybrid' | 'offline';

const localBridgeBaseUrl = (import.meta.env.VITE_LOCALBRIDGE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

export interface DataClient {
  mode: AppMode;
  isLocalFirst: boolean;
  localBridgeBaseUrl: string;
}

export function getDataClient(): DataClient {
  const isVercelOrCloud = typeof window !== 'undefined' && 
    (window.location.hostname.includes('vercel.app') || 
     window.location.hostname.includes('mpm-food-portal') ||
     (!['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname) && window.location.hostname !== ''));

  const mode = isVercelOrCloud ? 'cloud' : (import.meta.env.VITE_APP_MODE || 'offline');
  const isLocalFirst = !isVercelOrCloud && (mode === 'offline' || mode === 'hybrid');

  console.log(`🔑 [DataClient] mode: ${mode}, isLocalFirst: ${isLocalFirst}, baseUrl: ${localBridgeBaseUrl}`);
  return {
    mode: mode as AppMode,
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
  const port = localBridgeBaseUrl.split(':').pop() || '8787';
  const localHostStr = `localhost:${port}`;
  const localIpStr = `127.0.0.1:${port}`;
  if (urlStr.includes(localHostStr)) {
    urlStr = urlStr.replace(localHostStr, localIpStr);
  }

  const isLocal = urlStr.startsWith(localBridgeBaseUrl) || 
                  urlStr.includes(localIpStr);

  // Hard timeout for requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  const fetchInit = {
    ...init,
    signal: controller.signal,
  };

  console.log(`🔑 [smartFetch] START: ${urlStr} (Local: ${isLocal}, Tauri: ${isTauri})`);

  try {
    let response: Response;

    // Only use Tauri's specialized fetch if we are actually running inside Tauri
    if (isLocal && (isTauri || import.meta.env.PROD)) {
      try {
        console.log('🔑 [smartFetch] Routing via Tauri HTTP Plugin...');
        // Cast to any for plugin-specific options if needed
        response = await tauriFetch(urlStr, fetchInit as any);
        console.log(`🔑 [smartFetch] Tauri Plugin SUCCESS: ${response.status} (${urlStr})`);
      } catch (e) {
        console.error('🚫 [smartFetch] Tauri Fetch Plugin FAILED:', e);
        console.log('�� [smartFetch] Falling back to standard browser fetch...');
        response = await fetch(urlStr, fetchInit);
      }
    } else {
      response = await fetch(urlStr, fetchInit);
    }

    clearTimeout(timeoutId);
    console.log(`🔑 [smartFetch] DONE: ${response.status} (${urlStr})`);
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`🚫 [smartFetch] TIMEOUT EXCEEDED: ${urlStr}`);
    } else {
      console.error(`🚫 [smartFetch] NETWORK ERROR: ${urlStr}`, err);
    }
    throw err;
  }
};
