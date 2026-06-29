export type AppMode = 'cloud' | 'hybrid' | 'offline';

const FALLBACK_SUPABASE_URL = "https://onsqvduklnwffugsiybs.supabase.co";
const localBridgeBaseUrl = (import.meta.env.VITE_LOCALBRIDGE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

export interface DataClient {
  mode: AppMode;
  isLocalFirst: boolean;
  localBridgeBaseUrl: string;
}

/**
 * Detect if we are running inside an Android WebView.
 * On Android, the local-bridge Node.js sidecar does NOT exist,
 * so we must fall back to the pure IndexedDB offline mode.
 */
function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Detect if we are running inside the Tauri desktop runtime.
 */
function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  if (isAndroid()) return false;
  return (
    (window as any).__TAURI_INTERNALS__ !== undefined ||
    (window as any).__TAURI__ !== undefined ||
    navigator.userAgent.includes('Tauri')
  );
}

export function getDataClient(): DataClient {
  const android = isAndroid();
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const tauri = isTauriDesktop();
  const forceCloud = typeof window !== 'undefined' && (window.location.search.includes('force_cloud=true') || window.location.hash.includes('force_cloud=true'));
  
  // On Android there is no local-bridge sidecar — use IndexedDB fallback (isLocalFirst = false)
  // On HTTPS/browser (Vercel), Mixed Content rules block HTTP local-bridge requests, so use pure cloud
  const localFirst = !android && (!isHttps || tauri) && !forceCloud;
  const baseUrl = localFirst 
    ? localBridgeBaseUrl 
    : (import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL).replace(/\/$/, '');

  console.log(
    `🔑 [DataClient] mode: offline, isLocalFirst: ${localFirst}, android: ${android}, isHttps: ${isHttps}, tauri: ${tauri}, baseUrl: ${baseUrl}`
  );
  return {
    mode: 'offline',
    isLocalFirst: localFirst,
    localBridgeBaseUrl: baseUrl,
  };
}

// ─── Lazy Tauri HTTP Plugin loader ───────────────────────────────────────────
let _tauriFetch: typeof fetch | null | undefined = undefined;

async function getTauriFetch(): Promise<typeof fetch | null> {
  if (_tauriFetch !== undefined) return _tauriFetch;
  try {
    const mod = await import('@tauri-apps/plugin-http');
    _tauriFetch = mod.fetch as unknown as typeof fetch;
    console.log('🔑 [dataClient] Tauri HTTP plugin loaded successfully');
  } catch {
    _tauriFetch = null;
    console.log('🔑 [dataClient] Tauri HTTP plugin not available — using browser fetch');
  }
  return _tauriFetch;
}
// ─────────────────────────────────────────────────────────────────────────────

export const smartFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let urlStr = input.toString();

  // Standardize localhost → 127.0.0.1 for local-bridge requests
  if (urlStr.includes('localhost:8787')) {
    urlStr = urlStr.replace('localhost:8787', '127.0.0.1:8787');
  }

  const isLocal = urlStr.startsWith(localBridgeBaseUrl) || urlStr.includes('127.0.0.1:8787');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const fetchInit = {
    ...init,
    signal: controller.signal,
  };

  const tauri = isTauriDesktop();
  const android = isAndroid();

  console.log(`🔑 [smartFetch] START: ${urlStr} (Local: ${isLocal}, Tauri: ${tauri}, Android: ${android})`);

  try {
    let response: Response;

    // Route through Tauri HTTP plugin ONLY on Tauri desktop
    if (isLocal && tauri && !android) {
      const tauriFetch = await getTauriFetch();
      if (tauriFetch) {
        try {
          console.log('🔑 [smartFetch] Routing via Tauri HTTP Plugin...');
          response = await tauriFetch(urlStr, fetchInit as any);
          console.log(`🔑 [smartFetch] Tauri Plugin SUCCESS: ${response.status} (${urlStr})`);
        } catch (e) {
          console.error('🚫 [smartFetch] Tauri Fetch Plugin FAILED:', e);
          console.log('🔄 [smartFetch] Falling back to standard browser fetch...');
          response = await fetch(urlStr, fetchInit);
        }
      } else {
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

// Global Fetch Monkey Patch for Cloud Mode (Translates LocalBridge style requests to Supabase PostgREST)
if (typeof window !== 'undefined' && !(window as any).__fetch_patched__) {
  (window as any).__fetch_patched__ = true;
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const dc = getDataClient();
    if (!dc.isLocalFirst) {
      let urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as any).url);
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL).replace(/\/$/, '');
      
      if (urlStr.startsWith(supabaseUrl)) {
        let modified = false;
        
        // 1. Rewrite path parameters for single rows: /rest/v1/table/UUID -> /rest/v1/table?id=eq.UUID
        const uuidRegex = /\/rest\/v1\/([a-zA-Z0-9_-]+)\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;
        const pathMatch = urlStr.match(uuidRegex);
        if (pathMatch) {
          const tableName = pathMatch[1];
          const rowId = pathMatch[2];
          try {
            const urlObj = new URL(urlStr);
            urlObj.pathname = urlObj.pathname.replace(`/${tableName}/${rowId}`, `/${tableName}`);
            urlObj.searchParams.set('id', `eq.${rowId}`);
            urlStr = urlObj.toString();
            modified = true;
          } catch (e) {}
        }
        
        // 2. Rewrite query params: add eq. prefix if missing (required for PostgREST filtering)
        if (urlStr.includes('/rest/v1/')) {
          try {
            const urlObj = new URL(urlStr);
            let paramModified = false;
            
            const postgrestKeywords = ['select', 'order', 'limit', 'offset', 'columns', 'or', 'and', 'not', 'apikey'];
            for (const [key, val] of Array.from(urlObj.searchParams.entries())) {
              if (!postgrestKeywords.includes(key)) {
                const hasOperator = /^[a-z]{2,5}\./.test(val);
                if (!hasOperator) {
                  urlObj.searchParams.set(key, `eq.${val}`);
                  paramModified = true;
                }
              }
            }
            
            if (paramModified) {
              urlStr = urlObj.toString();
              modified = true;
            }
          } catch (e) {}
        }
        
        let newInit = init ? { ...init } : {};
        if (init && init.body && typeof init.body === 'string') {
          newInit.headers = {
            'Content-Type': 'application/json',
            ...(init.headers || {})
          };
          modified = true;
        }
        
        if (modified) {
          console.log(`🔄 [fetch patch] Rewriting ${input.toString()} -> ${urlStr}`);
          
          let finalInput: RequestInfo = urlStr;
          if (typeof input !== 'string' && !(input instanceof URL)) {
            const req = input as Request;
            try {
              finalInput = new Request(urlStr, req);
              if (newInit && newInit.body) {
                finalInput = new Request(urlStr, {
                  ...newInit,
                  headers: newInit.headers as HeadersInit
                });
              }
            } catch (e) {
              console.warn('[fetch patch] Request cloning failed, falling back to URL string:', e);
              const reqHeaders: Record<string, string> = {};
              req.headers.forEach((val, key) => {
                reqHeaders[key] = val;
              });
              newInit = {
                method: req.method,
                headers: {
                  ...reqHeaders,
                  ...(newInit?.headers || {})
                },
                credentials: req.credentials,
                mode: req.mode,
                referrer: req.referrer,
                ...newInit
              };
              finalInput = urlStr;
            }
          }
          
          return originalFetch(finalInput, newInit);
        }
      }
    }
    return originalFetch(input, init);
  };
}
