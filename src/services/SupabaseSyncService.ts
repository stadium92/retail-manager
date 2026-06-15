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
      if (!dataClient.isLocalFirst) {
        this.syncInProgress = false;
        return { pushed: 0, failed: 0 };
      }
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

          case 'user_create':
            supabaseTable = 'edge_function_create_user';
            mappedPayload = payload;
            break;

          case 'ingredient':
            supabaseTable = 'ingredients';
            mappedPayload = {
              id: payload.id,
              restaurant_id: payload.store_id || storeId,
              name: payload.name,
              unit: payload.unit,
              category: payload.category,
              current_stock: payload.current_stock || 0,
              min_threshold: payload.min_threshold || 0,
              cost_per_unit: payload.cost_per_unit || 0,
              expiry_date: payload.expiry_date || null,
              created_at: payload.created_at,
              updated_at: payload.updated_at,
              deleted_at: payload.deleted_at || null
            };
            break;

          case 'dish_recipe_save':
            supabaseTable = 'dish_recipe_save';
            break;

          case 'dish_recipe_remove':
            supabaseTable = 'dish_recipe_remove';
            break;

          case 'ingredient_movement':
            supabaseTable = 'ingredient_movements';
            mappedPayload = {
              id: payload.id,
              ingredient_id: payload.ingredient_id,
              movement_type: payload.movement_type,
              quantity_delta: payload.quantity_delta,
              related_dish_id: payload.related_dish_id || null,
              order_id: payload.order_id || null,
              note: payload.note || null,
              created_at: payload.created_at
            };
            break;

          case 'store':
            supabaseTable = 'restaurants';
            mappedPayload = {
              id: payload.id,
              name: payload.name,
              address: payload.address || null,
              phone: payload.phone || null,
              owner_id: payload.owner_id || null,
              default_price_tier: payload.default_price_tier || 1,
              version: payload.version || 1,
              created_at: payload.created_at,
              updated_at: payload.updated_at,
              deleted_at: payload.deleted_at || null
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

          if (supabaseTable === 'dish_recipe_save') {
            const { error: delErr } = await supabase
              .from('dish_recipes')
              .delete()
              .eq('dish_id', payload.dish_id);
            
            if (delErr) {
              error = delErr;
            } else if (payload.items && payload.items.length > 0) {
              const rows = payload.items.map((item: any) => ({
                id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
                dish_id: payload.dish_id,
                ingredient_id: item.ingredient_id,
                quantity_needed: item.quantity_needed,
                unit: item.unit,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }));
              const { error: insErr } = await supabase
                .from('dish_recipes')
                .insert(rows);
              error = insErr;
            }
          } else if (supabaseTable === 'dish_recipe_remove') {
            const { error: delErr } = await supabase
              .from('dish_recipes')
              .delete()
              .eq('dish_id', payload.dish_id)
              .eq('ingredient_id', payload.ingredient_id);
            error = delErr;
          } else if (entry.op_type === 'delete') {
            const { error: delErr } = await supabase
              .from(supabaseTable)
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', entry.entity_id);
            error = delErr;
          } else if (supabaseTable === 'edge_function_create_user') {
            // Retrieve caller's access token to authenticate with the edge function
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            
            const { data, error: edgeErr } = await supabase.functions.invoke('create-user', {
              body: mappedPayload,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            error = edgeErr;
            if (data?.error) {
               // The edge function returned a 400/500 error gracefully via JSON
               error = new Error(data.error);
            }
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
      const headers = dataClient.isLocalFirst ? await OfflineAuthService.getAuthHeaders() : {};
      if (dataClient.isLocalFirst && !headers) return { pulled: 0 };

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

      const { data: remoteIngredients } = await supabase
        .from('ingredients')
        .select('*')
        .eq('restaurant_id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteRecipes } = await supabase
        .from('dish_recipes')
        .select('*, ingredients!inner(restaurant_id)')
        .eq('ingredients.restaurant_id', storeId)
        .gt('updated_at', lastCursor);

      const { data: remoteMovements } = await supabase
        .from('ingredient_movements')
        .select('*, ingredients!inner(restaurant_id)')
        .eq('ingredients.restaurant_id', storeId)
        .gt('created_at', lastCursor);

      const { data: remoteStores } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', storeId)
        .gt('updated_at', lastCursor);

      // Additional tables fetched only in Pure Cloud mode
      let remoteProductFamilies: any[] = [];
      let remoteSuppliers: any[] = [];
      let remoteSupplierPayments: any[] = [];
      let remotePurchaseOrders: any[] = [];
      let remoteCashClosings: any[] = [];

      if (!dataClient.isLocalFirst) {
        const { data: pf } = await supabase
          .from('product_families')
          .select('*')
          .eq('restaurant_id', storeId)
          .gt('updated_at', lastCursor);
        remoteProductFamilies = pf || [];

        const { data: sup } = await supabase
          .from('suppliers')
          .select('*')
          .eq('restaurant_id', storeId)
          .gt('updated_at', lastCursor);
        remoteSuppliers = sup || [];

        const { data: pay } = await supabase
          .from('supplier_payments')
          .select('*')
          .eq('restaurant_id', storeId)
          .gt('created_at', lastCursor);
        remoteSupplierPayments = pay || [];

        const { data: po } = await supabase
          .from('purchase_orders')
          .select('*, purchase_items(*)')
          .eq('restaurant_id', storeId)
          .gt('updated_at', lastCursor);
        remotePurchaseOrders = po || [];

        const { data: cc } = await supabase
          .from('cash_closings')
          .select('*')
          .eq('restaurant_id', storeId)
          .gt('updated_at', lastCursor);
        remoteCashClosings = cc || [];
      }

      // Clean joined fields
      const cleanRecipes = (remoteRecipes || []).map(({ ingredients, ...rest }: any) => rest);
      const cleanMovements = (remoteMovements || []).map(({ ingredients, ...rest }: any) => rest);

      // Map nested order_items to items inside remoteOrders
      const mappedOrders = (remoteOrders || []).map((order: any) => {
        const { order_items, ...rest } = order;
        return {
          ...rest,
          items: order_items || []
        };
      });

      const hasUpdates = (mappedOrders && mappedOrders.length > 0) ||
                         (remoteProducts && remoteProducts.length > 0) ||
                         (remoteTables && remoteTables.length > 0) ||
                         (remoteIngredients && remoteIngredients.length > 0) ||
                         (cleanRecipes && cleanRecipes.length > 0) ||
                         (cleanMovements && cleanMovements.length > 0) ||
                         (remoteStores && remoteStores.length > 0) ||
                         (remoteProductFamilies.length > 0) ||
                         (remoteSuppliers.length > 0) ||
                         (remoteSupplierPayments.length > 0) ||
                         (remotePurchaseOrders.length > 0) ||
                         (remoteCashClosings.length > 0);

      if (hasUpdates) {
        if (dataClient.isLocalFirst) {
          // Send pulled data to localFastify backend /sync/merge route to insert into SQLite
          const mergeRes = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/merge`, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sales: mappedOrders,
              products: remoteProducts || [],
              tables_layout: remoteTables || [],
              ingredients: remoteIngredients || [],
              dish_recipes: cleanRecipes || [],
              ingredient_movements: cleanMovements || [],
              stores: remoteStores || []
            })
          });

          if (mergeRes.ok) {
            const mergeResult = await mergeRes.json();
            pulledCount = (mergeResult.merged?.sales || 0) + 
                          (mergeResult.merged?.products || 0) + 
                          (mergeResult.merged?.tables_layout || 0) +
                          (mergeResult.merged?.ingredients || 0) +
                          (mergeResult.merged?.dish_recipes || 0) +
                          (mergeResult.merged?.ingredient_movements || 0) +
                          (mergeResult.merged?.stores || 0);
            console.log(`✅ [SupabaseSync] Merged ${pulledCount} cloud items into local SQLite database.`);
          } else {
            console.error(`🚫 [SupabaseSync] Local SQLite merge failed: ${mergeRes.statusText}`);
            return { pulled: 0 };
          }
        } else {
          // Pure Cloud mode: Merge pulled data directly to browser IndexedDB LocalDatabase
          const { LocalDatabase } = await import('./LocalDatabase');
          await LocalDatabase.init();

          // 1. Save sales
          if (mappedOrders) {
            for (const sale of mappedOrders) {
              const mappedSale = {
                ...sale,
                order_status: sale.status,
                store_id: sale.restaurant_id,
                items: (sale.items || []).map((item: any) => ({
                  id: item.id,
                  sale_id: item.order_id,
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: Number(item.quantity),
                  unit_price: Number(item.unit_price),
                  discount: Number(item.discount),
                  total: Number(item.total),
                  modifiers: item.modifiers,
                  status: item.status,
                }))
              };
              await LocalDatabase.saveSale(mappedSale);
              pulledCount++;
            }
          }

          // 2. Save products (menu_items)
          if (remoteProducts) {
            for (const p of remoteProducts) {
              await LocalDatabase.saveInventoryItem({
                id: p.id,
                store_id: p.restaurant_id || storeId,
                product_name: p.name,
                sku: p.sku || undefined,
                barcode: p.barcode || undefined,
                quantity: p.quantity || 0,
                unit_price: p.unit_price || p.price || 0,
                wholesale_price: p.selling_price_3 || p.wholesale_price_ttc || 0,
                wholesale_price_ht: p.wholesale_price_ht || 0,
                wholesale_price_ttc: p.wholesale_price_ttc || 0,
                cost: p.cost_price || 0,
                category: p.category || undefined,
                unit_type: p.unit_type || undefined,
                packaging: p.packaging || undefined,
                prep_time_minutes: p.prep_time_minutes || 0,
                is_available: p.is_available,
                allergens: p.allergens,
                course_type: p.course_type || undefined,
                modifiers: p.modifiers,
                updated_at: p.updated_at || new Date().toISOString(),
                synced: true
              });
              pulledCount++;
            }
          }

          // 3. Save tables_layout
          if (remoteTables) {
            for (const t of remoteTables) {
              await LocalDatabase.saveSystemSetting(`table_layout:${t.id}`, t);
              pulledCount++;
            }
          }

          // 4. Save ingredients
          if (remoteIngredients) {
            for (const ing of remoteIngredients) {
              await LocalDatabase.saveSystemSetting(`ingredient:${ing.id}`, ing);
              pulledCount++;
            }
          }

          // 5. Save dish_recipes
          if (cleanRecipes) {
            for (const r of cleanRecipes) {
              await LocalDatabase.saveSystemSetting(`recipe:${r.id}`, r);
              pulledCount++;
            }
          }

          // 6. Save ingredient_movements
          if (cleanMovements) {
            for (const m of cleanMovements) {
              await LocalDatabase.saveSystemSetting(`movement:${m.id}`, m);
              pulledCount++;
            }
          }

          // 7. Save stores
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

          // 8. Save product_families
          if (remoteProductFamilies && remoteProductFamilies.length > 0) {
            for (const f of remoteProductFamilies) {
              await LocalDatabase.saveProductFamily({
                id: f.id,
                store_id: f.restaurant_id,
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

          // 9. Save suppliers
          if (remoteSuppliers && remoteSuppliers.length > 0) {
            for (const s of remoteSuppliers) {
              await LocalDatabase.saveSupplier({
                id: s.id,
                store_id: s.restaurant_id,
                name: s.name,
                phone: s.phone || undefined,
                email: s.email || undefined,
                address: s.address || undefined,
                balance: Number(s.balance) || 0,
                created_at: s.created_at,
                updated_at: s.updated_at,
                synced: true
              });
              pulledCount++;
            }
          }

          // 10. Save supplier_payments
          if (remoteSupplierPayments && remoteSupplierPayments.length > 0) {
            for (const p of remoteSupplierPayments) {
              await LocalDatabase.saveSupplierPayment({
                id: p.id,
                store_id: p.restaurant_id,
                supplier_id: p.supplier_id,
                amount: Number(p.amount) || 0,
                payment_method: p.payment_method || 'cash',
                reference: p.reference || undefined,
                notes: p.notes || undefined,
                created_at: p.created_at,
                synced: true
              });
              pulledCount++;
            }
          }

          // 11. Save purchase_orders and purchase_items
          if (remotePurchaseOrders && remotePurchaseOrders.length > 0) {
            for (const o of remotePurchaseOrders) {
              await LocalDatabase.savePurchaseOrder({
                id: o.id,
                store_id: o.restaurant_id,
                supplier_id: o.supplier_id,
                status: o.status,
                total_amount: Number(o.total_amount) || 0,
                notes: o.notes || undefined,
                created_at: o.created_at,
                updated_at: o.updated_at,
                synced: true
              });
              
              if (o.purchase_items) {
                for (const item of o.purchase_items) {
                  await LocalDatabase.saveSystemSetting(`purchase_item:${item.id}`, item);
                }
              }
              pulledCount++;
            }
          }

          // 12. Save cash_closings
          if (remoteCashClosings && remoteCashClosings.length > 0) {
            for (const cc of remoteCashClosings) {
              await LocalDatabase.saveCashClosing({
                id: cc.id,
                store_id: cc.restaurant_id,
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
          console.log(`✅ [SupabaseSync] Merged ${pulledCount} cloud items directly into IndexedDB.`);
        }

        // Compute new cursor based on highest updated_at
        let maxUpdatedAt = lastCursor;
        const allItems = [
          ...mappedOrders, 
          ...(remoteProducts || []), 
          ...(remoteTables || []),
          ...(remoteIngredients || []),
          ...(cleanRecipes || []),
          ...(remoteStores || []),
          ...remoteProductFamilies,
          ...remoteSuppliers,
          ...remoteSupplierPayments,
          ...remotePurchaseOrders,
          ...remoteCashClosings,
          ...(cleanMovements || []).map((m: any) => ({ ...m, updated_at: m.created_at }))
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ingredients',
        filter: `restaurant_id=eq.${storeId}`
      }, () => {
        console.log('⚡ [SupabaseSync] Realtime ingredients change detected, pulling...');
        this.pullRemoteChanges(storeId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'restaurants',
        filter: `id=eq.${storeId}`
      }, () => {
        console.log('⚡ [SupabaseSync] Realtime restaurant details change detected, pulling...');
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
