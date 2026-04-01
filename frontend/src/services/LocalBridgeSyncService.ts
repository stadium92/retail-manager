import { LocalDatabase } from './LocalDatabase';
import { getDataClient, smartFetch } from '@/lib/dataClient';

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
  
  private static getCloudConfig() {
    return {
      token: localStorage.getItem('jati_sync_token'),
      url: localStorage.getItem('jati_cloud_url') || 'http://localhost:3000'
    };
  }

  static async pushPendingMutations(): Promise<SyncPushResult> {
    const { token, url } = this.getCloudConfig();
    const dataClient = getDataClient();
    
    if (!dataClient.isLocalFirst || !token) {
      return { pushed: 0, failed: 0, pending: 0 };
    }

    await LocalDatabase.init();
    const queue = await LocalDatabase.getSyncQueue();
    const pendingLocal = queue.filter((item) => item.type === 'pending_mutation');

    let pushed = 0;
    let failed = 0;

    // 1. Process local mutations (idempotent push to Cloud)
    for (const item of pendingLocal) {
      const data = item.data || {};
      if (!data.entity || !data.payload) {
        await LocalDatabase.removeFromSyncQueue(item.id);
        continue;
      }

      try {
        const response = await fetch(`${url}/api/v1/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            store_id: data.store_id,
            sync_token: token,
            sales: data.entity === 'sales' ? [data.payload] : [],
            // Future: add products and customers here
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
    const { token, url } = this.getCloudConfig();
    if (!token) return null;

    try {
      const response = await fetch(`${url}/health`);
      if (!response.ok) return null;
      
      // Future: Implement full data pull (products, settings)
      return { pulled: 0 };
    } catch (e) {
      return null;
    }
  }
}
