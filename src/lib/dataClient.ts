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
  // On Android there is no local-bridge sidecar — use IndexedDB fallback (isLocalFirst = false)
  const localFirst = !android;

  console.log(
    `🔑 [DataClient] mode: offline, isLocalFirst: ${localFirst}, android: ${android}, baseUrl: ${localBridgeBaseUrl}`
  );
  return {
    mode: 'offline',
    isLocalFirst: localFirst,
    localBridgeBaseUrl,
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
