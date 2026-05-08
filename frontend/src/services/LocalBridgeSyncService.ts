import { LocalDatabase } from './LocalDatabase';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';

interface SyncPushResult {
  pushed: number;
  failed: number;
  pending: number;
}

/**
 * LocalBridgeSyncService: The bridge between the local app and the Djati Cloud VPS.
 * It uses the Jati Sync Token (Private Key) to authenticate every request.
 */
export class LocalBridgeSyncService {
  
  private static async getCloudConfig() {
    try {
      const { localBridgeBaseUrl } = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return null;
      
      const res = await fetch(`${localBridgeBaseUrl}/rest/v1/system/env`, { headers });
      const data = await res.json();
      
      if (res.ok && data.config) {
        return {
          token: data.config.MASTER_TOKEN,
          machineId: data.config.MACHINE_ID,
          url: localStorage.getItem('jati_cloud_url') || 'https://djati-cloud-hub.moh-kuhh.workers.dev'
        };
      }
      return null;
    } catch (e) {
      console.error('Failed to get cloud config', e);
      return null;
    }
  }

  static async pushPendingMutations(): Promise<SyncPushResult> {
    const config = await this.getCloudConfig();
    const dataClient = getDataClient();
    
    if (!dataClient.isLocalFirst || !config || !config.token) {
      return { pushed: 0, failed: 0, pending: 0 };
    }

    await LocalDatabase.init();
    const queue = await LocalDatabase.getSyncQueue();
    const pendingLocal = queue.filter((item) => item.type === 'pending_mutation');

    let pushed = 0;
    let failed = 0;

    for (const item of pendingLocal) {
      const data = item.data || {};
      if (!data.entity || !data.payload) {
        await LocalDatabase.removeFromSyncQueue(item.id);
        continue;
      }

      try {
        const response = await fetch(`${config.url}/api/v1/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            store_id: data.store_id,
            machine_id: config.machineId || 'UNKNOWN',
            sync_token: config.token,
            sales: data.entity === 'sales' ? [data.payload] : [],
            inventory: data.entity === 'inventory' || data.entity === 'products' ? [data.payload] : []
          }),
        });

        if (response.ok) {
          await LocalDatabase.removeFromSyncQueue(item.id);
          pushed += 1;
        } else {
          failed += 1;
        }
      } catch (e) {
        failed += 1;
      }
    }

    const remainingLocal = (await LocalDatabase.getSyncQueue()).filter((item) => item.type === 'pending_mutation').length;

    return {
      pushed,
      failed,
      pending: remainingLocal,
    };
  }

  static async pullData(): Promise<{ pulled: number } | null> {
    const config = await this.getCloudConfig();
    if (!config || !config.token) return null;

    try {
      const response = await fetch(`${config.url}/health`);
      if (!response.ok) return null;
      
      // Future: Implement full data pull (products, settings)
      return { pulled: 0 };
    } catch (e) {
      return null;
    }
  }
}
