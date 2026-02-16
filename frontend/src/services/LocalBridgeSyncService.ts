import { LocalDatabase } from './LocalDatabase';
import { getDataClient } from '@/lib/dataClient';

interface SyncPushResult {
  pushed: number;
  failed: number;
  pending: number;
}

export class LocalBridgeSyncService {
  private static async getSyncToken(serviceKey: string): Promise<string | null> {
    const dataClient = getDataClient();
    const response = await fetch(`${dataClient.localBridgeBaseUrl}/auth/token_exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabase_service_key: serviceKey }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return payload?.access_token || null;
  }

  static async pushPendingMutations(serviceKey: string): Promise<SyncPushResult> {
    const dataClient = getDataClient();
    if (!dataClient.isLocalFirst) {
      return { pushed: 0, failed: 0, pending: 0 };
    }

    const token = await this.getSyncToken(serviceKey);
    if (!token) {
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
        failed += 1;
        continue;
      }

      const response = await fetch(`${dataClient.localBridgeBaseUrl}/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supabase_service_key: serviceKey,
          entity: data.entity,
          payload: data.payload,
          store_id: data.store_id,
        }),
      });

      if (response.ok) {
        await LocalDatabase.removeFromSyncQueue(item.id);
        pushed += 1;
      } else {
        failed += 1;
      }
    }

    const backendResponse = await fetch(`${dataClient.localBridgeBaseUrl}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ supabase_service_key: serviceKey }),
    });

    let backendResult: SyncPushResult = { pushed: 0, failed: 0, pending: 0 };
    if (backendResponse.ok) {
      backendResult = (await backendResponse.json().catch(() => backendResult)) as SyncPushResult;
    } else {
      failed += 1;
    }

    const remainingLocal = (await LocalDatabase.getSyncQueue()).filter((item) => item.type === 'pending_mutation').length;

    return {
      pushed: pushed + backendResult.pushed,
      failed: failed + backendResult.failed,
      pending: remainingLocal + backendResult.pending,
    };
  }

  static async pullProducts(serviceKey: string, storeId?: string): Promise<{ pulled: number } | null> {
    const dataClient = getDataClient();
    if (!dataClient.isLocalFirst) {
      return null;
    }

    const token = await this.getSyncToken(serviceKey);
    if (!token) {
      return null;
    }

    const url = new URL(`${dataClient.localBridgeBaseUrl}/sync/pull`);
    if (storeId) {
      url.searchParams.set('store_id', storeId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json().catch(() => null);
  }
}
