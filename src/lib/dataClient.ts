export type AppMode = 'cloud' | 'hybrid' | 'offline';

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
 * Returns false on Android, pure browsers, and Capacitor builds.
 */
function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  // Never treat Android as Tauri desktop even if somehow the UA includes 'Tauri'
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
  const forceLocal = typeof window !== 'undefined' && (window.location.search.includes('force_local=true') || window.location.hash.includes('force_local=true'));
  
  // On web browser (non-Tauri), we must use pure cloud mode because the local-bridge sidecar is not available.
  // We only run localFirst if we are running inside the Tauri desktop app itself, or if force_local is explicitly passed.
  const localFirst = (tauri || forceLocal) && !android && !forceCloud;
  const baseUrl = localFirst 
    ? localBridgeBaseUrl 
    : (import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co').replace(/\/$/, '');

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
// undefined = not yet resolved  |  null = plugin not available  |  fn = loaded
let _tauriFetch: typeof fetch | null | undefined = undefined;

async function getTauriFetch(): Promise<typeof fetch | null> {
  if (_tauriFetch !== undefined) return _tauriFetch;
  try {
    const mod = await import('@tauri-apps/plugin-http');
    _tauriFetch = mod.fetch as unknown as typeof fetch;
    console.log('🔑 [dataClient] Tauri HTTP plugin loaded successfully');
  } catch {
    // Running outside Tauri (browser, Android WebView, etc.)
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

  // Hard timeout for all requests
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

    // Route through Tauri HTTP plugin ONLY on Tauri desktop (never on Android or browser)
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
      // Android, browser, Capacitor, or external URLs — always use native fetch
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

// Global Fetch Monkey Patch for Cloud Mode
if (typeof window !== 'undefined' && !(window as any).__fetch_patched__) {
  (window as any).__fetch_patched__ = true;
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const dc = getDataClient();
    if (!dc.isLocalFirst) {
      let urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as any).url);
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co').replace(/\/$/, '');
      
      if (urlStr.startsWith(supabaseUrl)) {
        let modified = false;
        
        // 1. Rewrite /rest/v1/products -> /rest/v1/menu_items
        if (urlStr.includes('/rest/v1/products')) {
          urlStr = urlStr.replace('/rest/v1/products', '/rest/v1/menu_items');
          modified = true;
        }
        
        // 2. Rewrite /rest/v1/stores -> /rest/v1/restaurants
        if (urlStr.includes('/rest/v1/stores')) {
          urlStr = urlStr.replace('/rest/v1/stores', '/rest/v1/restaurants');
          modified = true;
        }

        // 2.5. Rewrite path parameters for single rows: /rest/v1/table/UUID -> /rest/v1/table?id=eq.UUID
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
        
        // 3. Rewrite query params: store_id -> restaurant_id and auto-add eq. prefix if missing
        if (urlStr.includes('/rest/v1/')) {
          try {
            const urlObj = new URL(urlStr);
            let paramModified = false;
            
            if (urlObj.searchParams.has('store_id')) {
              const val = urlObj.searchParams.get('store_id') || '';
              urlObj.searchParams.delete('store_id');
              urlObj.searchParams.set('restaurant_id', val);
              paramModified = true;
            }
            
            // Prefix filter parameters with 'eq.' if they don't have an operator prefix
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
          } catch(e) {}
        }
        
        let newInit = init ? { ...init } : {};
        // 4. Rewrite body parameters (store_id -> restaurant_id)
        if (init && init.body && typeof init.body === 'string') {
          newInit.headers = {
            'Content-Type': 'application/json',
            ...(init.headers || {})
          };
          
          try {
            const bodyJson = JSON.parse(init.body);
            let bodyModified = false;
            
            if (bodyJson.store_id !== undefined) {
              bodyJson.restaurant_id = bodyJson.store_id;
              delete bodyJson.store_id;
              bodyModified = true;
            }
            if (bodyJson.selling_price_detail !== undefined) {
              bodyJson.unit_price = bodyJson.selling_price_detail;
              delete bodyJson.selling_price_detail;
              bodyModified = true;
            }
            // Parse JSON strings for array columns in Supabase
            if (bodyJson.allergens && typeof bodyJson.allergens === 'string') {
              try {
                bodyJson.allergens = JSON.parse(bodyJson.allergens);
                bodyModified = true;
              } catch(e){}
            }
            if (bodyJson.modifiers && typeof bodyJson.modifiers === 'string') {
              try {
                bodyJson.modifiers = JSON.parse(bodyJson.modifiers);
                bodyModified = true;
              } catch(e){}
            }
            if (bodyJson.pack_items && typeof bodyJson.pack_items === 'string') {
              try {
                bodyJson.pack_items = JSON.parse(bodyJson.pack_items);
                bodyModified = true;
              } catch(e){}
            }
            
            if (bodyModified) {
              newInit.body = JSON.stringify(bodyJson);
            }
          } catch (e) {}
          modified = true;
        }
        
        if (modified) {
          console.log(`🔄 [fetch patch] Rewriting ${input.toString()} -> ${urlStr}`);
          
          let finalInput: RequestInfo = urlStr;
          if (typeof input !== 'string' && !(input instanceof URL)) {
            const req = input as Request;
            try {
              // Clone original request with new URL to keep headers/method/body stream intact
              finalInput = new Request(urlStr, req);
              if (newInit && newInit.body) {
                // Merge headers from the original request and newInit to avoid stripping auth tokens
                const mergedHeaders: Record<string, string> = {};
                req.headers.forEach((val, key) => {
                  mergedHeaders[key] = val;
                });
                mergedHeaders['Content-Type'] = 'application/json';
                if (init && init.headers) {
                  const initHeaders = init.headers as any;
                  if (typeof initHeaders.forEach === 'function') {
                    initHeaders.forEach((val: string, key: string) => {
                      mergedHeaders[key] = val;
                    });
                  } else {
                    Object.keys(initHeaders).forEach(key => {
                      mergedHeaders[key] = initHeaders[key];
                    });
                  }
                }
                
                // If body was modified, override with newInit options
                finalInput = new Request(urlStr, {
                  ...newInit,
                  headers: mergedHeaders
                });
              }
            } catch (e) {
              console.warn('[fetch patch] Request cloning failed, falling back to URL string:', e);
              // Fallback: build manual headers merge
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
          
          const response = await originalFetch(finalInput, newInit);
          
          if (response.ok && response.status !== 204) {
            try {
              const clone = response.clone();
              const json = await clone.json();
              
              const mapObj = (obj: any) => {
                if (obj && typeof obj === 'object') {
                  if (Array.isArray(obj)) {
                    obj.forEach(mapObj);
                  } else {
                    if (obj.restaurant_id !== undefined && obj.store_id === undefined) {
                      obj.store_id = obj.restaurant_id;
                    }
                    if (obj.unit_price !== undefined && obj.selling_price_detail === undefined) {
                      obj.selling_price_detail = obj.unit_price;
                    }
                    Object.keys(obj).forEach(key => {
                      mapObj(obj[key]);
                    });
                  }
                }
              };
              
              mapObj(json);
              
              const jsonStr = JSON.stringify(json);
              return new Response(jsonStr, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
              });
            } catch (e) {
              return response;
            }
          }
          return response;
        }
      }
    }
    return originalFetch(input, init);
  };
}

