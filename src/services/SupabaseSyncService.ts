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
   * Pushes pending outbox mutations from SQLite to Supabase
   */
  static async pushPendingMutations(storeId: string): Promise<{ pushed: number; failed: number }> {
    if (this.syncInProgress) return { pushed: 0, failed: 0 };
    this.syncInProgress = true;

    let pushedCount = 0;
    let failedCount = 0;

    try {
      const dataClient = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) {
        this.syncInProgress = false;
        return { pushed: 0, failed: 0 };
      }

      // Fetch pending outbox entries from localFastify backend (emitted by SQLite triggers/repos)
      const res = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/outbox?store_id=${storeId}&limit=50`, {
        method: 'GET',
        headers
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch outbox: ${res.statusText}`);
      }

      const entries = await res.json() as any[];
      if (!entries || entries.length === 0) {
        this.syncInProgress = false;
        return { pushed: 0, failed: 0 };
      }

      console.log(`🔄 [SupabaseSync] Found ${entries.length} pending local mutations to sync to cloud.`);

      for (const entry of entries) {
        const payload = JSON.parse(entry.payload_json);
        let supabaseTable = '';
        let mappedPayload: any = null;

        // Map entities and payloads to Supabase tables
        switch (entry.entity_type) {
          case 'product':
          case 'inventory':
            supabaseTable = 'menu_items';
            mappedPayload = {
              id: payload.id,
              restaurant_id: payload.store_id || storeId,
              name: payload.name,
              sku: payload.sku || null,
              barcode: payload.barcode || null,
              description: payload.description || null,
              cost_price: payload.cost_price || 0,
              unit_price: payload.unit_price || payload.price || 0,
              selling_price_2: payload.selling_price_2 || 0,
              selling_price_3: payload.selling_price_3 || 0,
              selling_price_4: payload.selling_price_4 || 0,
              wholesale_price_ht: payload.wholesale_price_ht || 0,
              wholesale_price_ttc: payload.wholesale_price_ttc || 0,
              quantity: payload.quantity || 0,
              category: payload.category || null,
              image_url: payload.image_url || null,
              unit_type: payload.unit_type || null,
              packaging: payload.packaging || null,
              prep_time_minutes: payload.prep_time_minutes || 0,
              is_available: payload.is_available === 0 ? false : true,
              allergens: typeof payload.allergens === 'string' ? JSON.parse(payload.allergens) : (payload.allergens || []),
              course_type: payload.course_type || null,
              modifiers: typeof payload.modifiers === 'string' ? JSON.parse(payload.modifiers) : (payload.modifiers || []),
              version: payload.version || 1,
              created_at: payload.created_at,
              updated_at: payload.updated_at,
              deleted_at: payload.deleted_at || null
            };
            break;

          case 'sale':
            supabaseTable = 'orders';
            mappedPayload = {
              id: payload.id,
              restaurant_id: payload.store_id || storeId,
              worker_id: payload.worker_id || null,
              waiter_id: payload.waiter_id || null,
              customer_name: payload.customer_name || null,
              customer_phone: payload.customer_phone || null,
              order_type: payload.order_type || 'dine_in',
              status: payload.order_status || payload.status || 'pending',
              total_price: payload.total_price || payload.total || 0,
              discount: payload.discount || 0,
              tax: payload.tax || 0,
              payment_method: payload.payment_method || 'cash',
              payment_status: payload.payment_status || 'unpaid',
              notes: payload.notes || null,
              invoice_number: payload.invoice_number || null,
              table_number: payload.table_number || null,
              kitchen_notes: payload.kitchen_notes || null,
              estimated_prep_time: payload.estimated_prep_time || null,
              version: payload.version || 1,
              created_at: payload.created_at,
              updated_at: payload.updated_at,
              deleted_at: payload.deleted_at || null
            };
            break;

          case 'sale_item':
            supabaseTable = 'order_items';
            mappedPayload = {
              id: payload.id,
              order_id: payload.sale_id,
              product_id: payload.product_id || null,
              product_name: payload.product_name || 'Plat',
              quantity: payload.quantity || 1,
              unit_price: payload.unit_price || 0,
              discount: payload.discount || 0,
              total: payload.total || (payload.quantity * payload.unit_price) || 0,
              modifiers: typeof payload.modifiers === 'string' ? JSON.parse(payload.modifiers) : (payload.modifiers || []),
              status: payload.status || 'pending',
              version: payload.version || 1,
              created_at: payload.created_at,
              deleted_at: payload.deleted_at || null
            };
            break;

          case 'tables_layout':
            supabaseTable = 'tables_layout';
            mappedPayload = {
              id: payload.id,
              restaurant_id: payload.store_id || storeId,
              table_number: payload.table_number,
              capacity: payload.capacity || 4,
              status: payload.status || 'available',
              current_order_id: payload.current_order_id || null,
              zone: payload.zone || null,
              position_x: payload.position_x || 0,
              position_y: payload.position_y || 0,
              created_at: payload.created_at,
              updated_at: payload.updated_at
            };
            break;

          default:
            // Skip unknown entities for now by marking them acked
            await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/outbox/status`, {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ id: entry.id, status: 'acked' })
            });
            continue;
        }

        try {
          let error = null;

          if (entry.op_type === 'delete') {
            const { error: delErr } = await supabase
              .from(supabaseTable)
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', entry.entity_id);
            error = delErr;
          } else {
            const { error: upsErr } = await supabase
              .from(supabaseTable)
              .upsert(mappedPayload);
            error = upsErr;
          }

          if (error) {
            console.error(`🚫 [SupabaseSync] Supabase sync error for ${supabaseTable} (ID: ${entry.entity_id}):`, error);
            // Increment local bridge outbox retry count
            await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/outbox/retry`, {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ id: entry.id, error: error.message })
            });
            failedCount++;
          } else {
            // Mark as synced/acked in local outbox
            await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/outbox/status`, {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ id: entry.id, status: 'acked' })
            });
            pushedCount++;
          }
        } catch (dbErr: any) {
          console.error(`🚫 [SupabaseSync] Database connection/sync error:`, dbErr);
          await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/outbox/retry`, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: entry.id, error: dbErr.message || 'Supabase request failed' })
          });
          failedCount++;
        }
      }
    } catch (e) {
      console.error('🚫 [SupabaseSync] pushPendingMutations failed:', e);
    } finally {
      this.syncInProgress = false;
    }

    return { pushed: pushedCount, failed: failedCount };
  }

  /**
   * Pulls remote changes from Supabase and merges them into SQLite
   */
  static async pullRemoteChanges(storeId: string): Promise<{ pulled: number }> {
    let pulledCount = 0;
    try {
      const dataClient = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return { pulled: 0 };

      // Load last pull time cursor from localStorage
      const cursorKey = `supabase_sync_cursor:${storeId}`;
      const lastCursor = localStorage.getItem(cursorKey) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // Default to 30 days ago

      console.log(`🔄 [SupabaseSync] Pulling remote updates from Supabase since: ${lastCursor}`);

      // Query Supabase tables for items updated since cursor
      const { data: remoteOrders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('restaurant_id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteProducts } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteTables } = await supabase
        .from('tables_layout')
        .select('*')
        .eq('restaurant_id', storeId)
        .gt('updated_at', lastCursor);

      const hasUpdates = (remoteOrders && remoteOrders.length > 0) ||
                         (remoteProducts && remoteProducts.length > 0) ||
                         (remoteTables && remoteTables.length > 0);

      if (hasUpdates) {
        // Send pulled data to localFastify backend /sync/merge route to insert into SQLite
        const mergeRes = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/merge`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sales: remoteOrders || [],
            products: remoteProducts || [],
            tables_layout: remoteTables || []
          })
        });

        if (mergeRes.ok) {
          const mergeResult = await mergeRes.json();
          pulledCount = (mergeResult.merged?.sales || 0) + (mergeResult.merged?.products || 0) + (mergeResult.merged?.tables_layout || 0);
          console.log(`✅ [SupabaseSync] Merged ${pulledCount} cloud items into local SQLite database.`);
          
          // Compute new cursor based on highest updated_at
          let maxUpdatedAt = lastCursor;
          const allItems = [...(remoteOrders || []), ...(remoteProducts || []), ...(remoteTables || [])];
          for (const item of allItems) {
            if (item.updated_at && item.updated_at > maxUpdatedAt) {
              maxUpdatedAt = item.updated_at;
            }
          }
          localStorage.setItem(cursorKey, maxUpdatedAt);
          window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
        } else {
          console.error(`🚫 [SupabaseSync] Local SQLite merge failed: ${mergeRes.statusText}`);
        }
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

    console.log(`🔌 [SupabaseSync] Initializing Supabase Realtime for restaurant: ${storeId}`);

    this.realtimeChannel = supabase
      .channel(`restaurant_realtime:${storeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${storeId}`
      }, () => {
        console.log('⚡ [SupabaseSync] Realtime order change detected, pulling...');
        this.pullRemoteChanges(storeId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tables_layout',
        filter: `restaurant_id=eq.${storeId}`
      }, () => {
        console.log('⚡ [SupabaseSync] Realtime tables layout change detected, pulling...');
        this.pullRemoteChanges(storeId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'menu_items',
        filter: `restaurant_id=eq.${storeId}`
      }, () => {
        console.log('⚡ [SupabaseSync] Realtime menu item change detected, pulling...');
        this.pullRemoteChanges(storeId);
      })
      .subscribe();
  }

  /**
   * Starts periodic sync background worker loops
   */
  static startSyncCycle(storeId: string, intervalMs = 10000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Run first sync immediately
    this.runSync(storeId);

    // Setup realtime listener
    this.setupRealtimeSubscriptions(storeId);

    // Setup periodic polling interval
    this.syncInterval = setInterval(() => {
      this.runSync(storeId);
    }, intervalMs);

    // Listen to online events to sync immediately
    window.addEventListener('online', () => {
      console.log('🌐 [SupabaseSync] Device is online! Syncing immediately.');
      toast({
        title: 'Connexion rétablie',
        description: 'Synchronisation des données en cours...',
      });
      this.runSync(storeId);
    });
  }

  private static async runSync(storeId: string) {
    if (!navigator.onLine) {
      return;
    }
    await this.pushPendingMutations(storeId);
    await this.pullRemoteChanges(storeId);
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
