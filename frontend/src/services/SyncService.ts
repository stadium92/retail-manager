/**
 * SyncService - Handles syncing local data with the server
 * Runs when the app comes back online
 */

import { LocalDatabase, SyncQueueItem } from './LocalDatabase';
import { toast } from '@/hooks/use-toast';
import { smartFetch } from '@/lib/dataClient';
import i18n from '@/i18n/config';

export interface SyncResult {
  success: number;
  failed: number;
  pending: number;
}

export class SyncService {
  private static syncInProgress = false;

  /**
   * Add an item to the sync queue and trigger sync if online
   */
  static async addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
    };

    await LocalDatabase.init();
    await LocalDatabase.addToSyncQueue(queueItem);

    // If online, trigger a sync attempt for this item
    if (navigator.onLine) {
      // Trigger sync in background
      this.syncAll().catch(err => console.warn('Background sync failed:', err));
    }
  }

  /**
   * Sync all pending items with the server
   */
  static async syncAll(): Promise<SyncResult> {
    console.log('🚀 [SyncService] Sync is currently disabled. Everything is local.');
    return { success: true, processed: 0, failed: 0 };
  }

  /**
   * Process a single queue item
   */
  private static async processQueueItem(item: SyncQueueItem): Promise<boolean> {
    switch (item.type) {
      case 'user_create':
        return this.syncUserCreate(item.data);
      case 'sale':
        return this.syncSale(item.data);
      case 'inventory_update':
        return this.syncInventoryUpdate(item.data);
      case 'delivery_update':
        return this.syncDeliveryUpdate(item.data);
      case 'store_create':
        return this.syncStoreCreate(item.data);
      case 'store_update':
        return this.syncStoreUpdate(item.data);
      case 'pending_mutation':
        return this.syncPendingMutation(item.data);
      default:
        console.warn('Unknown sync item type:', item.type);
        return true; // Remove unknown items
    }
  }

  /**
   * Sync user creation
   */
  private static async syncUserCreate(data: any): Promise<boolean> {
    // Cloud sync disabled – user creation is local-only via the local bridge.
    console.warn('[SyncService] syncUserCreate: cloud sync disabled, skipping item.');
    return true;
  }

  /**
   * Sync a sale - uses sale_items for multi-item sales
   */
  private static async syncSale(data: any): Promise<boolean> {
    // Cloud sync disabled – sales are stored locally via the local bridge.
    console.warn('[SyncService] syncSale: cloud sync disabled, skipping item.');
    await LocalDatabase.markSaleSynced(data.id);
    return true;
  }

  /**
   * Sync inventory update (to products table)
   */
  private static async syncInventoryUpdate(data: any): Promise<boolean> {
    // Cloud sync disabled – inventory is managed locally via the local bridge.
    console.warn('[SyncService] syncInventoryUpdate: cloud sync disabled, skipping item.');
    return true;
  }

  /**
   * Sync delivery update
   */
  private static async syncDeliveryUpdate(data: any): Promise<boolean> {
    // Cloud sync disabled – deliveries are managed locally via the local bridge.
    console.warn('[SyncService] syncDeliveryUpdate: cloud sync disabled, skipping item.');
    return true;
  }

  /**
   * Sync store creation
   */
  private static async syncStoreCreate(data: any): Promise<boolean> {
    // Cloud sync disabled – stores are created locally via the local bridge.
    console.warn('[SyncService] syncStoreCreate: cloud sync disabled, skipping item.');
    await LocalDatabase.markStoreSynced(data.id);
    return true;
  }

  /**
   * Sync store update
   */
  private static async syncStoreUpdate(data: any): Promise<boolean> {
    // Cloud sync disabled – stores are updated locally via the local bridge.
    console.warn('[SyncService] syncStoreUpdate: cloud sync disabled, skipping item.');
    await LocalDatabase.markStoreSynced(data.id);
    return true;
  }


  /**
   * Sync pending mutations via LocalBridge
   */
  private static async syncPendingMutation(data: any): Promise<boolean> {
    try {
      const { getDataClient } = await import('@/lib/dataClient');
      const dataClient = getDataClient();
      if (!dataClient.isLocalFirst) {
        return true;
      }
      const { OfflineAuthService } = await import('./OfflineAuthService');
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) {
        return false;
      }
      const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          supabase_service_key: data.supabase_service_key,
          entity: data.entity,
          payload: data.payload,
          store_id: data.store_id,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error syncing pending mutations:', error);
      return false;
    }
  }

  /**
   * Setup automatic sync when coming back online
   */
  static setupAutoSync(): void {
    window.addEventListener('online', () => {
      console.log('Back online, starting sync...');
      toast({
        title: i18n.t('sync.backOnline'),
        description: i18n.t('sync.syncingPending'),
      });
      this.syncAll();
    });
  }

  /**
   * Get current sync status
   */
  static async getSyncStatus(): Promise<{
    queueSize: number;
    isOnline: boolean;
    isSyncing: boolean;
  }> {
    return {
      queueSize: await LocalDatabase.getSyncQueueSize(),
      isOnline: navigator.onLine,
      isSyncing: this.syncInProgress,
    };
  }
}
