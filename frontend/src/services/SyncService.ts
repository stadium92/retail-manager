/**
 * SyncService - Handles syncing local data with the server
 * Runs when the app comes back online
 */

import { LocalDatabase, SyncQueueItem } from './LocalDatabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SupabaseProvisioningService } from './SupabaseProvisioningService';
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
    if (this.syncInProgress || !navigator.onLine) {
      return { success: 0, failed: 0, pending: await LocalDatabase.getSyncQueueSize() };
    }

    this.syncInProgress = true;
    let success = 0;
    let failed = 0;

    try {
      await LocalDatabase.init();
      const queue = await LocalDatabase.getSyncQueue();

      for (const item of queue) {
        if (item.type === 'pending_mutation') {
          // Requires explicit service key; skip auto-sync.
          continue;
        }
        try {
          const result = await this.processQueueItem(item);
          if (result) {
            await LocalDatabase.removeFromSyncQueue(item.id);
            success++;
          } else {
            // Increment retries
            item.retries++;
            if (item.retries >= 3) {
              await LocalDatabase.removeFromSyncQueue(item.id);
              failed++;
              console.error('Max retries reached for sync item:', item);
            }
          }
        } catch (error) {
          console.error('Error syncing item:', error);
          item.retries++;
          if (item.retries >= 3) {
            await LocalDatabase.removeFromSyncQueue(item.id);
            failed++;
          }
        }
      }

      const pending = await LocalDatabase.getSyncQueueSize();

      if (success > 0 || failed > 0) {
        toast({
          title: i18n.t('sync.syncComplete'),
          description: i18n.t('sync.syncResultsPending', { success, failed, pending }),
        });
      }

      return { success, failed, pending };
    } finally {
      this.syncInProgress = false;
    }
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
    try {
      const result = await SupabaseProvisioningService.provisionUser({
        email: data.email,
        password: data.password,
        full_name: data.fullName,
        role: data.role,
        store_id: data.storeId,
      });

      if (!result.success) {
        console.error('Failed to sync user creation:', result.error);
        return false;
      }

      // Update local user as synced
      if (data.localUserId) {
        const localUser = await LocalDatabase.getUser(data.localUserId);
        if (localUser) {
          localUser.synced = true;
          await LocalDatabase.saveUser(localUser);
        }
      }

      return true;
    } catch (error) {
      console.error('Error syncing user creation:', error);
      return false;
    }
  }

  /**
   * Sync a sale - uses sale_items for multi-item sales
   */
  private static async syncSale(data: any): Promise<boolean> {
    try {
      // For legacy single-item sales or multi-item sales
      const items = data.items || [];
      const firstItem = items[0];
      
      // Insert sale with item_id (required by schema) - use first item or placeholder
      const { error: saleError } = await supabase.from('sales').insert({
        id: data.id,
        store_id: data.store_id,
        worker_id: data.worker_id,
        item_id: firstItem?.product?.id || firstItem?.product_id || data.item_id,
        unit_price: firstItem?.product?.unit_price || firstItem?.unit_price || data.unit_price || 0,
        quantity: items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0) || data.quantity || 1,
        total_price: data.total_price,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        notes: data.notes,
      });

      if (saleError) {
        console.error('Failed to sync sale:', saleError);
        return false;
      }

      // Insert sale items for multi-item sales
      if (items.length > 0) {
        const saleItems = items.map((item: any) => ({
          sale_id: data.id,
          product_id: item.product?.id || item.product_id,
          product_name: item.product?.name || item.product_name,
          quantity: item.quantity,
          unit_price: item.product?.unit_price || item.unit_price,
          total: item.total || item.lineTotal,
          discount: item.discount || 0,
        }));

        const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
        if (itemsError) {
          console.error('Failed to sync sale items:', itemsError);
          // Sale was created, items failed - partial success
        }
      }

      // Mark local sale as synced
      await LocalDatabase.markSaleSynced(data.id);
      return true;
    } catch (error) {
      console.error('Error syncing sale:', error);
      return false;
    }
  }

  /**
   * Sync inventory update (to products table)
   */
  private static async syncInventoryUpdate(data: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('products')
        .upsert({
          id: data.id,
          store_id: data.store_id,
          name: data.name || data.product_name,
          sku: data.sku,
          barcode: data.barcode,
          description: data.description,
          quantity: data.quantity ?? data.stock,
          unit_price: data.unit_price || data.price,
          cost_price: data.cost_price || data.cost,
          wholesale_price: data.wholesale_price,
          wholesale_price_ht: data.wholesale_price_ht,
          wholesale_price_ttc: data.wholesale_price_ttc,
          selling_price_2: data.selling_price_2,
          selling_price_3: data.selling_price_3,
          selling_price_4: data.selling_price_4,
          packaging: data.packaging,
          unit_type: data.unit_type,
          category_id: data.category_id || data.category,
          brand: data.brand,
          aisle: data.aisle,
          image_url: data.image_url,
          low_stock_threshold: data.low_stock_threshold ?? data.min_quantity,
          reorder_quantity: data.reorder_quantity,
          expiry_date: data.expiry_date,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to sync inventory:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error syncing inventory:', error);
      return false;
    }
  }

  /**
   * Sync delivery update
   */
  private static async syncDeliveryUpdate(data: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          status: data.status,
          delivered_at: data.delivered_at,
          notes: data.notes,
        })
        .eq('id', data.id);

      if (error) {
        console.error('Failed to sync delivery update:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error syncing delivery update:', error);
      return false;
    }
  }

  /**
   * Sync store creation
   */
  private static async syncStoreCreate(data: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('stores')
        .insert({
          id: data.id,
          name: data.name,
          address: data.address,
          phone: data.phone,
          owner_id: data.owner_id,
        });

      if (error) {
        console.error('Failed to sync store creation:', error);
        return false;
      }

      // Mark local store as synced
      await LocalDatabase.markStoreSynced(data.id);
      return true;
    } catch (error) {
      console.error('Error syncing store creation:', error);
      return false;
    }
  }

  /**
   * Sync store update
   */
  private static async syncStoreUpdate(data: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          name: data.name,
          address: data.address,
          city: data.city,
          phone: data.phone,
          email: data.email,
          is_active: data.is_active,
        })
        .eq('id', data.id);

      if (error) {
        console.error('Failed to sync store update:', error);
        return false;
      }

      await LocalDatabase.markStoreSynced(data.id);
      return true;
    } catch (error) {
      console.error('Error syncing store update:', error);
      return false;
    }
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
