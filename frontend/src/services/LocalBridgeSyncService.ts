import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';

export type NetworkHealthStatus = 'ONLINE' | 'OFFLINE' | 'CLOCK_SKEW' | 'FIREWALL_BLOCKED' | 'ISP_BLOCKED' | 'RATE_LIMITED';

export class LocalBridgeSyncService {
  private static running = false;
  private static eventSource: EventSource | null = null;
  private static currentStoreId: string | null = null;
  // Periodic outbox flush - see the comment in start(). Without these the only
  // push in the entire app was a single call at login.
  private static pushTimer: ReturnType<typeof setInterval> | null = null;
  private static onlineHandler: (() => void) | null = null;
  private static readonly PUSH_INTERVAL_MS = 60_000;

  // Diagnostics & Health State
  private static currentHealth: NetworkHealthStatus = 'ONLINE';
  private static currentHealthMessage: string = 'Connected to local sync bridge';
  private static healthListeners: Array<(status: NetworkHealthStatus, message: string) => void> = [];

  static onHealthChange(cb: (status: NetworkHealthStatus, message: string) => void) {
    this.healthListeners.push(cb);
    cb(this.currentHealth, this.currentHealthMessage);
    return () => {
      this.healthListeners = this.healthListeners.filter(l => l !== cb);
    };
  }

  private static updateHealth(status: NetworkHealthStatus, message: string) {
    if (this.currentHealth !== status || this.currentHealthMessage !== message) {
      this.currentHealth = status;
      this.currentHealthMessage = message;
      this.healthListeners.forEach(cb => cb(status, message));
    }
  }

  static async checkNetworkHealth(): Promise<void> {
    const dataClient = getDataClient();
    try {
      const resp = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/health`);
      if (resp.ok) {
        const data = await resp.json();
        this.updateHealth(data.status, data.message);
      } else {
        this.updateHealth('OFFLINE', 'Local bridge is unreachable.');
      }
    } catch (e) {
      this.updateHealth('OFFLINE', 'Local bridge is unreachable.');
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  static start(storeId: string): void {
    if (this.running && this.currentStoreId === storeId) return;
    this.stop();

    this.currentStoreId = storeId;
    this.running = true;

    // Run initial health check and sync trigger
    void this.checkNetworkHealth();
    void this.pushPendingMutations(storeId);
    void this.pullData(storeId);

    // Keep pushing on a timer. This used to be the ONLY push in the whole app -
    // one call, at login, and nothing else: no interval, no online listener, no
    // retry. A sale made after login therefore sat in the outbox until the next
    // time the app was restarted, and a backlog could only shrink by roughly one
    // drain per launch. A real install reached 3 919 queued rows spanning five
    // months that way, and its owner's dashboard showed nothing recent because
    // the queue had only drained as far as March.
    //
    // A push with an empty queue is cheap (the route returns immediately), so
    // running it periodically costs nothing when there is nothing to send.
    this.pushTimer = setInterval(() => {
      if (!this.running || !this.currentStoreId) return;
      void this.pushPendingMutations(this.currentStoreId);
    }, this.PUSH_INTERVAL_MS);

    // Connectivity coming back is the single best moment to flush - it is
    // exactly when a backlog accumulated offline can finally move.
    this.onlineHandler = () => {
      if (!this.running || !this.currentStoreId) return;
      console.log('[LocalBridgeSyncService] Back online - flushing pending mutations.');
      void this.pushPendingMutations(this.currentStoreId);
    };
    window.addEventListener('online', this.onlineHandler);

    // Setup Server-Sent Events (SSE) listener
    const dataClient = getDataClient();
    try {
      this.eventSource = new EventSource(`${dataClient.localBridgeBaseUrl}/sync/events`);

      this.eventSource.onopen = () => {
        console.log('[LocalBridgeSyncService] SSE connection established.');
        this.updateHealth('ONLINE', 'Connected to local sync bridge');
      };

      this.eventSource.onerror = (err) => {
        console.error('[LocalBridgeSyncService] SSE connection error:', err);
        this.updateHealth('OFFLINE', 'Sync bridge connection lost. Reconnecting...');
      };

      this.eventSource.addEventListener('data_merged', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          console.log('[LocalBridgeSyncService] SSE data_merged received:', payload);
          if (payload.type === 'product') {
            window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'product' } }));
          } else if (payload.type === 'sale') {
            window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
          } else if (payload.type === 'cashier_credit') {
            window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'cashier_credit' } }));
          } else if (payload.type === 'inventory') {
            window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
          }
        } catch (err) {
          console.error('[LocalBridgeSyncService] Error parsing SSE payload:', err);
        }
      });
    } catch (e) {
      console.error('[LocalBridgeSyncService] Failed to establish EventSource:', e);
    }

    console.log(`[LocalBridgeSyncService] Started for store ${storeId}.`);
  }

  static stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.pushTimer) {
      clearInterval(this.pushTimer);
      this.pushTimer = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.currentStoreId = null;

    console.log('[LocalBridgeSyncService] Stopped.');
  }

  // ── PUSH: outbox → Supabase (Triggered via Backend HTTP) ────────────────────
  static async pushPendingMutations(storeId?: string): Promise<{ pushed: number; failed: number; pending: number }> {
    const dataClient = getDataClient();
    const targetStoreId = storeId || this.currentStoreId;

    if (!targetStoreId) {
      return { pushed: 0, failed: 0, pending: 0 };
    }

    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) {
        return { pushed: 0, failed: 0, pending: 0 };
      }

      const response = await smartFetch(
        `${dataClient.localBridgeBaseUrl}/sync/push?store_id=${targetStoreId}`,
        {
          method: 'POST',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`Outbox push failed: HTTP ${response.status}`);
      }

      const result = await response.json();
      return {
        pushed: result.pushed || 0,
        failed: result.failed || 0,
        pending: result.pending || 0,
      };
    } catch (err) {
      console.error('[LocalBridgeSyncService] pushPendingMutations error:', err);
      return { pushed: 0, failed: 0, pending: 0 };
    }
  }

  // ── PULL: Supabase → local bridge (Triggered via Backend HTTP) ──────────────
  static async pullData(storeId?: string): Promise<{ pulled: number } | null> {
    const dataClient = getDataClient();
    const targetStoreId = storeId || this.currentStoreId;

    if (!targetStoreId) return null;

    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return null;

      const response = await smartFetch(
        `${dataClient.localBridgeBaseUrl}/sync/pull?store_id=${targetStoreId}`,
        {
          method: 'POST',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`Data pull failed: HTTP ${response.status}`);
      }

      return { pulled: 0 }; // Backend handles actual pull and SSE notifications
    } catch (err) {
      console.error('[LocalBridgeSyncService] pullData error:', err);
      return null;
    }
  }

  // ── Manual retry ───────────────────────────────────────────────────────────
  static async retryFailed(): Promise<void> {
    const dataClient = getDataClient();
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;

      const resp = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/outbox/retry`, {
        method: 'POST',
        headers
      });
      if (!resp.ok) throw new Error(`Retry reset failed: HTTP ${resp.status}`);
      const { reset_count } = await resp.json();
      console.log(`[LocalBridgeSyncService] ${reset_count} failed entries reset — retrying…`);
      if (this.currentStoreId) {
        await this.pushPendingMutations(this.currentStoreId);
      }
    } catch (err) {
      console.error('[LocalBridgeSyncService] retryFailed error:', err);
    }
  }
}
