/**
 * SyncService - Handles syncing local data with the server
 * Runs when the app comes back online
 */

import { LocalDatabase, SyncQueueItem } from './LocalDatabase';
import { toast } from '@/hooks/use-toast';
import { smartFetch, getDataClient } from '@/lib/dataClient';
import { supabase } from '@/lib/supabase';
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
   * Sync all pending items with the server: the explicit sync queue (used by
   * local-bridge pending mutations) plus a scan for any locally-saved
   * records still marked synced:false (sales/stores saved while offline, or
   * whose direct online write failed at creation time). Cloud-mode only -
   * local-bridge/Tauri syncs via its own backend process.
   */
  static async syncAll(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { success: 0, failed: 0, pending: await LocalDatabase.getSyncQueueSize() };
    }
    this.syncInProgress = true;

    let success = 0;
    let failed = 0;

    try {
      const { isLocalFirst } = getDataClient();

      const queue = await LocalDatabase.getSyncQueue();
      for (const item of queue) {
        const ok = await this.processQueueItem(item);
        if (ok) {
          await LocalDatabase.removeFromSyncQueue(item.id);
          success++;
        } else {
          failed++;
        }
      }

      if (!isLocalFirst && navigator.onLine) {
        const saleResult = await this.syncUnsyncedSales();
        success += saleResult.success;
        failed += saleResult.failed;

        const storeResult = await this.syncUnsyncedStores();
        success += storeResult.success;
        failed += storeResult.failed;
      }
    } finally {
      this.syncInProgress = false;
    }

    const pending = await LocalDatabase.getSyncQueueSize();
    return { success, failed, pending };
  }

  /**
   * Push any locally-saved sales still marked synced:false to Supabase.
   * Mirrors the field mapping OfflineSalesService.createSale() uses for its
   * direct online write, so a sale looks identical to Supabase regardless of
   * whether it synced immediately or was queued while offline.
   */
  private static async syncUnsyncedSales(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    try {
      await LocalDatabase.init();
      const allSales = await LocalDatabase.getSales();
      const unsynced = allSales.filter(s => !s.synced);

      for (const sale of unsynced) {
        try {
          const now = new Date().toISOString();
          const mappedSale = {
            id: sale.id,
            store_id: sale.store_id || localStorage.getItem('worker_store_id') || null,
            worker_id: sale.worker_id || null,
            customer_name: sale.customer_name || null,
            customer_phone: sale.customer_phone || null,
            sale_type: sale.sale_type || 'detail',
            total_price: Number(sale.total_price || 0),
            amount_paid: Number((sale as any).amount_paid || sale.total_price || 0),
            payment_method: sale.payment_method || 'cash',
            payment_status: sale.payment_status || 'paid',
            invoice_number: sale.invoice_number || null,
            created_at: sale.created_at || now,
            updated_at: now,
          };

          const { error: saleErr } = await supabase.from('sales').upsert(mappedSale);
          if (saleErr) throw saleErr;

          const items = (sale.items || []).map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            sale_id: sale.id,
            product_id: item.product_id || item.productId || null,
            product_name: item.product_name || item.productName || item.designation || 'Unknown',
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price ?? item.unitPrice ?? 0),
            discount: Number(item.discount ?? item.discountPercent ?? 0),
            total: Number(item.total ?? item.lineTotal ?? 0),
            created_at: now,
          }));

          if (items.length > 0) {
            const { error: itemsErr } = await supabase.from('sale_items').upsert(items);
            if (itemsErr) throw itemsErr;
          }

          await LocalDatabase.markSaleSynced(sale.id);
          success++;
        } catch (e) {
          console.error('[SyncService] Failed to sync sale', sale.id, e);
          failed++;
        }
      }
    } catch (e) {
      console.error('[SyncService] syncUnsyncedSales error:', e);
    }
    return { success, failed };
  }

  /**
   * Push any locally-saved stores still marked synced:false to Supabase.
   */
  private static async syncUnsyncedStores(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    try {
      await LocalDatabase.init();
      const allStores = await LocalDatabase.getAllStores();
      const unsynced = allStores.filter(s => !s.synced);

      for (const store of unsynced) {
        try {
          const { error } = await supabase.from('stores').upsert({
            id: store.id,
            name: store.name,
            address: store.address || null,
            city: store.city || null,
            phone: store.phone || null,
            email: store.email || null,
            default_price_tier: store.default_price_tier,
            is_active: store.is_active,
            created_at: store.created_at,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;

          await LocalDatabase.markStoreSynced(store.id);
          success++;
        } catch (e) {
          console.error('[SyncService] Failed to sync store', store.id, e);
          failed++;
        }
      }
    } catch (e) {
      console.error('[SyncService] syncUnsyncedStores error:', e);
    }
    return { success, failed };
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
      case 'password_change':
        return this.syncPasswordChange(item.data);
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
   * Push a password change made while offline (Cloud mode only - already
   * cached locally by OfflineAuthService.changePassword() at the time of
   * the change) to Supabase once back online. Relies on the current
   * browser session still holding a valid JWT for this user.
   */
  private static async syncPasswordChange(data: { userId: string; newPassword: string }): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== data.userId) {
        console.warn('[SyncService] syncPasswordChange: no matching active session, will retry later.');
        return false;
      }
      const { error } = await supabase.auth.updateUser({ password: data.newPassword });
      if (error) {
        console.error('[SyncService] syncPasswordChange failed:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[SyncService] syncPasswordChange error:', error);
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
