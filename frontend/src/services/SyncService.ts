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

      // Run the scan-based passes (records tracked by their own synced:false
      // flag in LocalDatabase) *before* draining the generic sync_queue.
      // Several queue item types (store_create/update, sale, inventory_update)
      // represent records that are ALSO tracked this way; their handlers
      // below just confirm the record actually reached Supabase rather than
      // re-pushing it, so this ordering matters - processing the queue first
      // used to let disabled/stub handlers mark things "synced" without ever
      // writing them, which then made the scan skip them entirely.
      if (!isLocalFirst && navigator.onLine) {
        const saleResult = await this.syncUnsyncedSales();
        success += saleResult.success;
        failed += saleResult.failed;

        const storeResult = await this.syncUnsyncedStores();
        success += storeResult.success;
        failed += storeResult.failed;

        const inventoryResult = await this.syncUnsyncedInventory();
        success += inventoryResult.success;
        failed += inventoryResult.failed;

        const cashierCreditResult = await this.syncUnsyncedCashierCredits();
        success += cashierCreditResult.success;
        failed += cashierCreditResult.failed;

        const stockAdjustmentResult = await this.syncUnsyncedStockAdjustments();
        success += stockAdjustmentResult.success;
        failed += stockAdjustmentResult.failed;

        const cashClosingResult = await this.syncUnsyncedCashClosings();
        success += cashClosingResult.success;
        failed += cashClosingResult.failed;

        const productFamilyResult = await this.syncUnsyncedProductFamilies();
        success += productFamilyResult.success;
        failed += productFamilyResult.failed;
      }

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
          // OfflineSalesService.deleteSale() soft-deletes locally (sets
          // deleted_at + synced:false) so it shows up here too. Push the
          // delete instead of upserting, or a sale deleted while offline
          // would get resurrected in Supabase by the upsert below.
          if ((sale as any).deleted_at) {
            // DISABLED - this issued a real, irreversible DELETE against
            // production Supabase driven purely by browser IndexedDB state.
            //
            // syncAll() is called from AuthContext's `online` handler, which
            // fires on any connectivity blip, tab wake or network change - on
            // the WEB build too, where IndexedDB is just a browser store that
            // can be stale, belong to a different session, or predate changes
            // made elsewhere. Observed live: three real sales disappeared from
            // production within a twenty-minute window with no corresponding
            // entry in the desktop's outbox, i.e. nothing on the till asked
            // for them to be deleted.
            //
            // The asymmetry is what makes it unacceptable: an upsert that is
            // wrong can be corrected by the next sync, but a delete is gone.
            // Until deletes are driven by the same audited outbox the desktop
            // uses - with a device id and a journal entry saying who asked and
            // when - a browser cache must not be able to destroy a sale.
            //
            // Left un-synced deliberately: NOT marking it synced means the row
            // stays flagged, so a proper delete path can pick it up later
            // rather than the intent being silently discarded.
            console.warn(
              '[SyncService] Refusing to delete sale from Supabase based on local IndexedDB state:',
              sale.id
            );
            continue;
          }

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
   * Push any locally-saved inventory items still marked synced:false to
   * Supabase. Mirrors the field mapping OfflineInventoryService.createItem()/
   * updateItem() use for their direct online writes.
   */
  private static async syncUnsyncedInventory(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    try {
      await LocalDatabase.init();
      const allItems = await LocalDatabase.getInventory();
      const unsynced = allItems.filter(i => !i.synced);

      for (const item of unsynced) {
        try {
          const now = new Date().toISOString();
          const mapped = {
            id: item.id,
            store_id: item.store_id,
            name: item.product_name,
            sku: item.sku || null,
            barcode: item.barcode || null,
            cost_price: Number(item.cost || 0),
            unit_price: Number(item.unit_price || 0),
            selling_price_2: Number(item.selling_price_2 || 0),
            selling_price_3: Number(item.selling_price_3 || 0),
            selling_price_4: Number(item.selling_price_4 || 0),
            wholesale_price: Number(item.wholesale_price || 0),
            wholesale_price_ht: Number(item.wholesale_price_ht || 0),
            wholesale_price_ttc: Number(item.wholesale_price_ttc || 0),
            quantity: Number(item.quantity || 0),
            category: (item.category && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(item.category)) ? item.category : null,
            aisle: item.aisle || null,
            brand: item.brand || null,
            unit_type: item.unit_type || null,
            packaging: item.packaging || null,
            expiry_date: item.expiry_date || null,
            reorder_quantity: Number(item.reorder_quantity || 0),
            min_quantity: Number(item.low_stock_threshold || 0),
            updated_at: item.updated_at || now,
          };

          const { error } = await supabase.from('products').upsert(mapped);
          if (error) throw error;

          await LocalDatabase.markInventorySynced(item.id);
          success++;
        } catch (e) {
          console.error('[SyncService] Failed to sync inventory item', item.id, e);
          failed++;
        }
      }
    } catch (e) {
      console.error('[SyncService] syncUnsyncedInventory error:', e);
    }
    return { success, failed };
  }

  /**
   * Push any locally-saved cashier credits still marked synced:false to
   * Supabase. These are saved locally by OfflineAuthService.localBridgeRequest()
   * when the direct '/rest/v1/cashier_credits' POST fails or the app is offline.
   */
  private static async syncUnsyncedCashierCredits(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    try {
      await LocalDatabase.init();
      const all = await LocalDatabase.getCashierCredits();
      const unsynced = all.filter(c => !c.synced);

      for (const credit of unsynced) {
        try {
          const { error } = await supabase.from('cashier_credits').upsert({
            id: credit.id,
            store_id: credit.store_id,
            worker_id: credit.worker_id || null,
            client_name: credit.client_name,
            amount: Number(credit.amount),
            status: credit.status,
            notes: credit.notes || null,
            created_at: credit.created_at,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;

          await LocalDatabase.markCashierCreditSynced(credit.id);
          success++;
        } catch (e) {
          console.error('[SyncService] Failed to sync cashier credit', credit.id, e);
          failed++;
        }
      }
    } catch (e) {
      console.error('[SyncService] syncUnsyncedCashierCredits error:', e);
    }
    return { success, failed };
  }

  /**
   * Push any locally-saved stock adjustments still marked synced:false to
   * Supabase. Saved locally by OfflineAuthService.localBridgeRequest() when
   * the direct '/rest/v1/stock_adjustments' POST fails or the app is offline.
   */
  private static async syncUnsyncedStockAdjustments(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    try {
      await LocalDatabase.init();
      const all = await LocalDatabase.getStockAdjustments();
      const unsynced = all.filter(a => !a.synced);

      for (const adj of unsynced) {
        try {
          const { error } = await supabase.from('stock_adjustments').upsert({
            id: adj.id,
            store_id: adj.store_id,
            worker_id: adj.worker_id || null,
            product_id: adj.product_id,
            adjustment_type: adj.adjustment_type,
            quantity_adjusted: Number(adj.quantity_adjusted),
            reason: adj.reason || null,
            created_at: adj.created_at,
          });
          if (error) throw error;

          await LocalDatabase.markStockAdjustmentSynced(adj.id);
          success++;
        } catch (e) {
          console.error('[SyncService] Failed to sync stock adjustment', adj.id, e);
          failed++;
        }
      }
    } catch (e) {
      console.error('[SyncService] syncUnsyncedStockAdjustments error:', e);
    }
    return { success, failed };
  }

  /**
   * Push any locally-saved cash register closings still marked synced:false
   * to Supabase. Saved locally by OfflineAuthService.localBridgeRequest()
   * when the direct '/rest/v1/cash_register_closures' POST fails or the app
   * is offline.
   */
  private static async syncUnsyncedCashClosings(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    try {
      await LocalDatabase.init();
      const all = await LocalDatabase.getCashClosings();
      const unsynced = all.filter(c => !c.synced);

      for (const closing of unsynced) {
        try {
          const { error } = await supabase.from('cash_closings').upsert({
            id: closing.id,
            store_id: closing.store_id,
            worker_id: closing.worker_id || null,
            opening_balance: Number(closing.opening_balance || 0),
            expected_balance: Number(closing.expected_balance || 0),
            actual_balance: Number(closing.actual_balance || 0),
            difference: Number(closing.difference || 0),
            bill_details_json: closing.bill_details_json,
            observations: closing.observations || null,
            status: closing.status || 'submitted',
            created_at: closing.created_at,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;

          await LocalDatabase.markCashClosingSynced(closing.id);
          success++;
        } catch (e) {
          console.error('[SyncService] Failed to sync cash closing', closing.id, e);
          failed++;
        }
      }
    } catch (e) {
      console.error('[SyncService] syncUnsyncedCashClosings error:', e);
    }
    return { success, failed };
  }

  /**
   * Push any locally-saved product families still marked synced:false to
   * Supabase. Saved locally by the "create family on the fly" fallback in
   * MobileFicheProduits.tsx when the direct Supabase insert fails or the
   * app is offline.
   */
  private static async syncUnsyncedProductFamilies(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    try {
      await LocalDatabase.init();
      const all = await LocalDatabase.getProductFamilies();
      const unsynced = all.filter(f => !f.synced);

      for (const family of unsynced) {
        try {
          const { error } = await supabase.from('product_families').upsert({
            id: family.id,
            store_id: family.store_id,
            name: family.name,
            description: family.description || null,
            parent_id: family.parent_id || null,
            created_at: family.created_at,
            updated_at: new Date().toISOString(),
          });
          if (error) throw error;

          await LocalDatabase.markProductFamilySynced(family.id);
          success++;
        } catch (e) {
          console.error('[SyncService] Failed to sync product family', family.id, e);
          failed++;
        }
      }
    } catch (e) {
      console.error('[SyncService] syncUnsyncedProductFamilies error:', e);
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
      case 'user_delete':
        return this.syncUserDelete(item.data);
      case 'sale':
        return this.syncSale(item.data);
      case 'inventory_update':
        return this.syncInventoryUpdate(item.data);
      case 'inventory_delete':
        return this.syncInventoryDelete(item.data);
      case 'delivery_update':
        return this.syncDeliveryUpdate(item.data);
      case 'store_create':
        return this.syncStoreCreate(item.data);
      case 'store_update':
        return this.syncStoreUpdate(item.data);
      case 'store_delete':
        return this.syncStoreDelete(item.data);
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
   * Sync a worker/deliverer created while offline (queued by
   * OfflineTeamService.createUser()) by actually invoking the same
   * 'create-user' edge function its online path uses. Previously this was a
   * disabled stub that returned true unconditionally - meaning any worker
   * created while offline was queued, then silently discarded (never
   * created in Supabase) the moment the app reconnected.
   */
  private static async syncUserCreate(data: any): Promise<boolean> {
    if (getDataClient().isLocalFirst) return true; // local-bridge creates its own users directly
    try {
      // Already synced by a previous pass (e.g. duplicate/stale queue entry)?
      if (data.localUserId) {
        const existing = await LocalDatabase.getUser(data.localUserId);
        if (existing?.synced) return true;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.fullName,
          phone: data.phone,
          role: data.role,
          sub_role: data.sub_role,
          store_id: data.storeId,
          vehicle_type: data.vehicleType,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (edgeErr || edgeData?.error) {
        console.error('[SyncService] syncUserCreate failed:', edgeErr || edgeData?.error);
        return false;
      }

      // Note: the Supabase Auth user gets a server-generated id, distinct
      // from the client-generated localUserId used while offline - we only
      // flip the local cache record to synced here, we don't re-key it.
      if (data.localUserId) await LocalDatabase.markUserSynced(data.localUserId);
      if (data.localRoleId) await LocalDatabase.markRoleSynced(data.localRoleId);
      return true;
    } catch (e) {
      console.error('[SyncService] syncUserCreate error:', e);
      return false;
    }
  }

  /**
   * Sync a team member deletion queued while offline (queued by
   * OfflineTeamService.deleteMember()) by invoking the same 'delete-user'
   * edge function its online path uses. Previously this type had no case at
   * all in processQueueItem(), so it fell into the "unknown item" default
   * and was removed from the queue without ever deleting the user from
   * Supabase - the member would reappear once any device re-fetched the
   * team list from Supabase.
   */
  private static async syncUserDelete(data: { roleId: string; userId: string }): Promise<boolean> {
    if (getDataClient().isLocalFirst) return true;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('delete-user', {
        body: { user_id: data.userId, role_id: data.roleId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (edgeErr || edgeData?.error) {
        console.error('[SyncService] syncUserDelete failed:', edgeErr || edgeData?.error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SyncService] syncUserDelete error:', e);
      return false;
    }
  }

  /**
   * Confirm a sale queued via the legacy OfflinePOSService.recordSale()
   * path (currently unreferenced elsewhere in the app, kept for defensive
   * correctness) actually reached Supabase. The real push happens in
   * syncUnsyncedSales(), which runs before the queue is drained in
   * syncAll() - this just verifies and, if not yet synced, leaves the item
   * queued for the next retry rather than blindly stamping it synced.
   */
  private static async syncSale(data: any): Promise<boolean> {
    if (getDataClient().isLocalFirst) return true;
    if (data?.id) {
      const sales = await LocalDatabase.getSales();
      const existing = sales.find(s => s.id === data.id);
      if (existing?.synced) return true;
    }
    return false;
  }

  /**
   * Confirm a products update queued via the legacy
   * OfflinePOSService.updateInventory() path (currently unreferenced
   * elsewhere in the app). Real push happens in syncUnsyncedInventory().
   */
  private static async syncInventoryUpdate(data: any): Promise<boolean> {
    if (getDataClient().isLocalFirst) return true;
    if (data?.id) {
      const existing = await LocalDatabase.getInventoryItem(data.id);
      if (existing?.synced) return true;
    }
    return false;
  }

  /**
   * Sync a product deletion queued by OfflineInventoryService.deleteItem()
   * when the direct Supabase delete failed or the app was offline.
   */
  private static async syncInventoryDelete(data: { id: string }): Promise<boolean> {
    if (getDataClient().isLocalFirst) return true;
    try {
      const { error } = await supabase.from('products').delete().eq('id', data.id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('[SyncService] syncInventoryDelete error:', e);
      return false;
    }
  }

  /**
   * Sync delivery update
   */
  private static async syncDeliveryUpdate(data: any): Promise<boolean> {
    // No cloud-mode caller currently queues this type (deliveries go through
    // OfflineManager's separate localStorage queue instead) - left disabled
    // rather than guessing at a schema. See audit notes.
    console.warn('[SyncService] syncDeliveryUpdate: not implemented, skipping item.');
    return true;
  }

  /**
   * Confirm a store creation queued by OfflineStoreService.createStore()
   * actually reached Supabase. The real push happens in
   * syncUnsyncedStores(), which runs before the queue is drained in
   * syncAll(). Previously this was a disabled stub that called
   * markStoreSynced() and returned true unconditionally - which, combined
   * with the old queue-before-scan ordering, marked the store "synced"
   * *before* syncUnsyncedStores() ran, so its scan would then skip the
   * record and it would never actually reach Supabase.
   */
  private static async syncStoreCreate(data: any): Promise<boolean> {
    if (getDataClient().isLocalFirst) return true;
    if (data?.id) {
      const existing = await LocalDatabase.getStore(data.id);
      if (existing?.synced) return true;
    }
    return false;
  }

  /**
   * Sync a store deletion queued by OfflineStoreService.deleteStore() when
   * the direct Supabase delete failed or the app was offline.
   */
  private static async syncStoreDelete(data: { id: string }): Promise<boolean> {
    if (getDataClient().isLocalFirst) return true;
    try {
      const { error } = await supabase.from('stores').delete().eq('id', data.id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('[SyncService] syncStoreDelete error:', e);
      return false;
    }
  }

  /**
   * Confirm a store update queued by OfflineStoreService.updateStore()
   * actually reached Supabase. Same verify-don't-blindly-mark rationale as
   * syncStoreCreate() above - the real push happens in syncUnsyncedStores().
   */
  private static async syncStoreUpdate(data: any): Promise<boolean> {
    return this.syncStoreCreate(data);
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
