import { supabase } from '../lib/supabase';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';
import { toast } from '@/hooks/use-toast';

export class SupabaseSyncService {
  private static syncInProgress = false;
  private static syncInterval: any = null;
  private static lastPullTime = 0;
  private static realtimeChannel: any = null;

  /**
   * Pushes pending outbox mutations (returns early in Pure Cloud mode)
   */
  static async pushPendingMutations(storeId: string): Promise<{ pushed: number; failed: number }> {
    // Pure Cloud mode does not use SQLite outbox
    return { pushed: 0, failed: 0 };
  }

  /**
   * Pulls remote changes from Supabase and merges them into IndexedDB
   */
  static async pullRemoteChanges(storeId: string): Promise<{ pulled: number }> {
    let pulledCount = 0;
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) return { pulled: 0 };

      // Load last pull time cursor from localStorage
      const cursorKey = `supabase_sync_cursor:${storeId}`;
      const lastCursor = localStorage.getItem(cursorKey) || '1970-01-01T00:00:00.000Z';

      console.log(`🔄 [SupabaseSync] Pulling remote updates since: ${lastCursor}`);

      // 1. Query Supabase tables for items updated since cursor
      const { data: remoteSales } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('store_id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteProducts } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteStores } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteProductFamilies } = await supabase
        .from('product_families')
        .select('*')
        .eq('store_id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteSuppliers } = await supabase
        .from('suppliers')
        .select('*')
        .eq('store_id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteSupplierPayments } = await supabase
        .from('supplier_payments')
        .select('*')
        .eq('store_id', storeId)
        .gt('created_at', lastCursor);

      const { data: remotePurchaseOrders } = await supabase
        .from('purchase_orders')
        .select('*, purchase_items(*)')
        .eq('store_id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteCashClosings } = await supabase
        .from('cash_closings')
        .select('*')
        .eq('store_id', storeId)
        .gt('updated_at', lastCursor);

      const hasUpdates = (remoteSales && remoteSales.length > 0) ||
                         (remoteProducts && remoteProducts.length > 0) ||
                         (remoteStores && remoteStores.length > 0) ||
                         (remoteProductFamilies && remoteProductFamilies.length > 0) ||
                         (remoteSuppliers && remoteSuppliers.length > 0) ||
                         (remoteSupplierPayments && remoteSupplierPayments.length > 0) ||
                         (remotePurchaseOrders && remotePurchaseOrders.length > 0) ||
                         (remoteCashClosings && remoteCashClosings.length > 0);

      if (hasUpdates) {
        const { LocalDatabase } = await import('./LocalDatabase');
        await LocalDatabase.init();

        // 1. Save sales
        if (remoteSales) {
          for (const s of remoteSales) {
            await LocalDatabase.saveSale({
              ...s,
              items: (s.sale_items || []).map((item: any) => ({
                id: item.id,
                sale_id: item.sale_id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                discount: Number(item.discount),
                total: Number(item.total)
              })),
              synced: true
            });
            pulledCount++;
          }
        }

        // 2. Save products
        if (remoteProducts) {
          for (const p of remoteProducts) {
            await LocalDatabase.saveInventoryItem({
              id: p.id,
              store_id: p.store_id || storeId,
              product_name: p.name,
              sku: p.sku || undefined,
              barcode: p.barcode || undefined,
              quantity: p.quantity || 0,
              unit_price: p.unit_price || p.price || 0,
              wholesale_price: p.wholesale_price || 0,
              wholesale_price_ht: p.wholesale_price_ht || 0,
              wholesale_price_ttc: p.wholesale_price_ttc || 0,
              selling_price_2: p.selling_price_2 || 0,
              selling_price_3: p.selling_price_3 || 0,
              selling_price_4: p.selling_price_4 || 0,
              cost: p.cost_price || 0,
              category: p.category || undefined,
              aisle: p.aisle || undefined,
              brand: p.brand || undefined,
              unit_type: p.unit_type || undefined,
              packaging: p.packaging || undefined,
              expiry_date: p.expiry_date || undefined,
              reorder_quantity: p.reorder_quantity || 0,
              low_stock_threshold: p.min_quantity || p.low_stock_threshold || 0,
              updated_at: p.updated_at || new Date().toISOString(),
              synced: true
            });
            pulledCount++;
          }
        }

        // 3. Save stores
        if (remoteStores) {
          for (const st of remoteStores) {
            await LocalDatabase.saveStore({
              id: st.id,
              name: st.name,
              address: st.address || undefined,
              city: st.city || undefined,
              phone: st.phone || undefined,
              email: st.email || undefined,
              default_price_tier: st.default_price_tier || 1,
              is_active: st.is_active !== false,
              created_at: st.created_at || new Date().toISOString(),
              updated_at: st.updated_at || new Date().toISOString(),
              synced: true
            });
            pulledCount++;
          }
        }

        // 4. Save product families
        if (remoteProductFamilies) {
          for (const f of remoteProductFamilies) {
            await LocalDatabase.saveProductFamily({
              id: f.id,
              store_id: f.store_id,
              name: f.name,
              description: f.description || undefined,
              parent_id: f.parent_id || undefined,
              created_at: f.created_at,
              updated_at: f.updated_at,
              synced: true
            });
            pulledCount++;
          }
        }

        // 5. Save suppliers
        if (remoteSuppliers) {
          for (const sup of remoteSuppliers) {
            await LocalDatabase.saveSupplier({
              id: sup.id,
              store_id: sup.store_id,
              name: sup.name,
              phone: sup.phone || undefined,
              email: sup.email || undefined,
              address: sup.address || undefined,
              balance: sup.balance || 0,
              default_purchase_type: sup.default_purchase_type || undefined,
              created_at: sup.created_at,
              updated_at: sup.updated_at,
              synced: true
            });
            pulledCount++;
          }
        }

        // 6. Save supplier payments
        if (remoteSupplierPayments) {
          for (const pay of remoteSupplierPayments) {
            await LocalDatabase.saveSupplierPayment({
              id: pay.id,
              store_id: pay.store_id,
              supplier_id: pay.supplier_id,
              amount: Number(pay.amount),
              payment_method: pay.payment_method,
              notes: pay.notes || undefined,
              is_confirmed: pay.is_confirmed !== false,
              created_at: pay.created_at,
              synced: true
            });
            pulledCount++;
          }
        }

        // 7. Save purchase orders
        if (remotePurchaseOrders) {
          for (const po of remotePurchaseOrders) {
            await LocalDatabase.savePurchaseOrder({
              id: po.id,
              store_id: po.store_id,
              supplier_id: po.supplier_id,
              status: po.status,
              total_amount: Number(po.total_amount || 0),
              notes: po.notes || undefined,
              created_at: po.created_at,
              updated_at: po.updated_at,
              synced: true,
              supplier_name: po.suppliers?.name
            });
            
            // Save nested purchase items
            if (po.purchase_items) {
              for (const item of po.purchase_items) {
                await LocalDatabase.savePurchaseItem({
                  id: item.id,
                  order_id: item.purchase_order_id || item.order_id,
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: Number(item.quantity),
                  unit_price: Number(item.purchase_price || item.unit_price || 0),
                  total: Number(item.total || 0)
                });
              }
            }
            pulledCount++;
          }
        }

        // 8. Save cash closings
        if (remoteCashClosings) {
          for (const cc of remoteCashClosings) {
            await LocalDatabase.saveCashClosing({
              id: cc.id,
              store_id: cc.store_id,
              worker_id: cc.worker_id,
              opening_balance: Number(cc.opening_balance) || 0,
              expected_balance: Number(cc.expected_balance) || 0,
              actual_balance: Number(cc.actual_balance) || 0,
              difference: Number(cc.difference) || 0,
              bill_details_json: cc.bill_details_json,
              observations: cc.observations || null,
              status: cc.status || 'submitted',
              created_at: cc.created_at,
              updated_at: cc.updated_at,
              synced: true
            });
            pulledCount++;
          }
        }

        console.log(`✅ [SupabaseSync] Merged ${pulledCount} cloud items directly into browser IndexedDB.`);

        // Compute new cursor based on highest updated_at
        let maxUpdatedAt = lastCursor;
        const allItems = [
          ...(remoteSales || []), 
          ...(remoteProducts || []), 
          ...(remoteStores || []),
          ...(remoteProductFamilies || []),
          ...(remoteSuppliers || []),
          ...(remoteSupplierPayments || []),
          ...(remotePurchaseOrders || []),
          ...(remoteCashClosings || [])
        ];
        for (const item of allItems) {
          if (item.updated_at && item.updated_at > maxUpdatedAt) {
            maxUpdatedAt = item.updated_at;
          }
        }
        localStorage.setItem(cursorKey, maxUpdatedAt);
        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
      }
    } catch (err) {
      console.error('🚫 [SupabaseSync] pullRemoteChanges failed:', err);
    }
    return { pulled: pulledCount };
  }

  /**
   * Set up real-time Postgres changes subscription via Supabase Realtime
   */
  static setupRealtimeSubscriptions(storeId: string) {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
    }

    console.log(`🔌 [SupabaseSync] Initializing Supabase Realtime for store: ${storeId}`);

    this.realtimeChannel = supabase
      .channel(`store_realtime:${storeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sales',
        filter: `store_id=eq.${storeId}`
      }, () => {
        console.log('⚡ [SupabaseSync] Realtime sales change detected, pulling...');
        this.pullRemoteChanges(storeId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `store_id=eq.${storeId}`
      }, () => {
        console.log('⚡ [SupabaseSync] Realtime products change detected, pulling...');
        this.pullRemoteChanges(storeId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stores',
        filter: `id=eq.${storeId}`
      }, () => {
        console.log('⚡ [SupabaseSync] Realtime store details change detected, pulling...');
        this.pullRemoteChanges(storeId);
      })
      .subscribe();
  }

  /**
   * Starts periodic sync background worker loops
   */
  static startSyncCycle(storeId: string, intervalMs = 15000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Run first sync immediately
    this.pullRemoteChanges(storeId);

    // Setup realtime listener
    this.setupRealtimeSubscriptions(storeId);

    // Setup periodic polling interval
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.pullRemoteChanges(storeId);
      }
    }, intervalMs);

    // Listen to online events to sync immediately
    window.addEventListener('online', () => {
      console.log('🌐 [SupabaseSync] Device is online! Syncing immediately.');
      toast({
        title: 'Connexion rétablie',
        description: 'Synchronisation des données en cours...',
      });
      this.setupRealtimeSubscriptions(storeId);
      this.pullRemoteChanges(storeId);
    });
  }

  /**
   * Stops the background worker loops
   */
  static stopSyncCycle() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
  }
}
