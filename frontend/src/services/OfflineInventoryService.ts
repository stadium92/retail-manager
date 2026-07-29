/**
 * OfflineInventoryService - Handles inventory operations with offline support
 * Uses 'products' table in Supabase and 'inventory' store in LocalDatabase
 */

import { LocalDatabase, LocalInventory, LocalProductFamily } from './LocalDatabase';
import { InventoryItem } from '@/types';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';
import { supabase } from '../lib/supabase';

// --- MAPPING HELPERS ---

function mapDbToInventoryItem(product: any): InventoryItem {
  return {
    id: product.id,
    store_id: product.store_id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    quantity: Number(product.quantity ?? product.stock ?? product.current_stock) || 0,
    price: Number(product.unit_price || product.price) || 0,
    wholesale_price: Number(product.wholesale_price_ttc || product.wholesale_price) || 0,
    wholesale_price_ht: Number(product.wholesale_price_ht) || 0,
    wholesale_price_ttc: Number(product.wholesale_price_ttc) || 0,
    selling_price_2: Number(product.selling_price_2) || 0,
    selling_price_3: Number(product.selling_price_3) || 0,
    selling_price_4: Number(product.selling_price_4) || 0,
    cost: Number(product.cost_price || product.cost) || 0,
    category_id: product.category || product.category_id,
    category_name: product.category_name ?? null,
    aisle: product.aisle,
    brand: product.brand,
    unit_type: product.unit_type,
    packaging: product.packaging,
    expiry_date: product.expiry_date,
    reorder_quantity: Number(product.reorder_quantity) || 0,
    low_stock_threshold: Number(product.low_stock_threshold ?? product.min_quantity ?? 0),
    image_url: product.image_url,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

function mapLocalInventoryToItem(local: LocalInventory): InventoryItem {
  return {
    id: local.id,
    store_id: local.store_id,
    name: local.product_name,
    sku: local.sku,
    barcode: (local as any).barcode,
    quantity: local.quantity,
    price: local.unit_price,
    wholesale_price: local.wholesale_price,
    wholesale_price_ht: local.wholesale_price_ht,
    wholesale_price_ttc: local.wholesale_price_ttc,
    selling_price_2: local.selling_price_2 || 0,
    selling_price_3: local.selling_price_3 || 0,
    selling_price_4: local.selling_price_4 || 0,
    cost: local.cost || 0,
    category_id: local.category,
    category_name: (local as any).category_name ?? null,
    aisle: local.aisle,
    brand: local.brand,
    unit_type: local.unit_type,
    packaging: local.packaging,
    expiry_date: local.expiry_date,
    reorder_quantity: local.reorder_quantity || 0,
    low_stock_threshold: local.low_stock_threshold ?? 0,
    updated_at: local.updated_at,
    created_at: (local as any).created_at || local.updated_at,
  };
}

function mapToLocalInventory(item: InventoryItem | any, synced: boolean = true): LocalInventory {
  return {
    id: item.id,
    store_id: item.store_id || item.restaurant_id,
    product_name: item.name || item.product_name,
    sku: item.sku,
    barcode: item.barcode,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price || item.price) || 0,
    wholesale_price: Number(item.wholesale_price) || 0,
    wholesale_price_ht: Number(item.wholesale_price_ht) || 0,
    wholesale_price_ttc: Number(item.wholesale_price_ttc) || 0,
    selling_price_2: Number(item.selling_price_2) || 0,
    selling_price_3: Number(item.selling_price_3) || 0,
    selling_price_4: Number(item.selling_price_4) || 0,
    cost: Number(item.cost_price || item.cost) || 0,
    category: item.category || item.category_id,
    category_name: item.category_name ?? null,
    aisle: item.aisle,
    brand: item.brand,
    unit_type: item.unit_type,
    packaging: item.packaging,
    expiry_date: item.expiry_date,
    reorder_quantity: Number(item.reorder_quantity) || 0,
    low_stock_threshold: Number(item.low_stock_threshold ?? item.min_quantity ?? 0),
    updated_at: item.updated_at || new Date().toISOString(),
    synced,
  };
}

export const OfflineInventoryService = {
  async getInventory(storeId: string, options?: { notify?: boolean }): Promise<{ data?: InventoryItem[]; error?: any }> {
    try {
      const dc = getDataClient();
      await LocalDatabase.init();
      
      const targetStoreId = storeId === 'all' ? undefined : storeId;

      // 1. Pure Cloud mode direct fetch
      if (!dc.isLocalFirst && navigator.onLine) {
        try {
          let query = supabase
            .from('products')
            .select('*')
            .order('name');
            
          if (targetStoreId) {
            query = query.eq('store_id', targetStoreId);
          }
          
          const { data, error } = await query;
          if (error) throw error;
          
          if (data) {
            const mapped = data.map(mapDbToInventoryItem);
            
            // Async cache to IndexedDB
            (async () => {
              try {
                for (const p of data) {
                  await LocalDatabase.saveInventoryItem(mapToLocalInventory(p, true));
                }
              } catch (e) {
                console.warn('[OfflineInventory] Failed to cache inventory item:', e);
              }
            })();
            
            return { data: mapped };
          }
        } catch (e) {
          console.warn('[OfflineInventory] Supabase direct fetch failed, falling back to local cache:', e);
        }
      }

      // 2. Local-First Bridge Fetch
      if (dc.isLocalFirst) {
        try {
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams();
            if (targetStoreId) {
              params.append('store_id', targetStoreId);
            }
            const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, { headers });
            if (res.ok) {
              const payload = await res.json();
              const remoteProducts = Array.isArray(payload) ? payload : (payload.data || []);
              const mappedItems = remoteProducts.map(mapDbToInventoryItem);

              if (options?.notify !== false) {
                window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
              }

              return { data: mappedItems };
            }
          }
        } catch (e) {
          console.warn('[OfflineInventory] Bridge fetch failed, falling back to local cache:', e);
        }
      }

      // 3. IndexedDB fallback
      const localInventory = await LocalDatabase.getInventory(targetStoreId);
      if (localInventory.length > 0) {
        return { data: localInventory.map(mapLocalInventoryToItem) };
      }
      
      return { data: [] };
    } catch (error) {
      console.error('[OfflineInventory] getInventory fatal error:', error);
      return { error };
    }
  },

  async getInventoryItem(id: string): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      await LocalDatabase.init();
      const local = await LocalDatabase.getInventoryItem(id);
      if (local) return { data: mapLocalInventoryToItem(local) };

      const dc = getDataClient();
      if (!dc.isLocalFirst && navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .maybeSingle();
            
          if (error) throw error;
          if (data) {
            const mapped = mapDbToInventoryItem(data);
            await LocalDatabase.saveInventoryItem(mapToLocalInventory(data, true));
            return { data: mapped };
          }
        } catch (e) {
          console.warn('[OfflineInventory] Failed to fetch product from Supabase:', e);
        }
      }

      return { data: undefined };
    } catch (error) {
      return { error };
    }
  },

  async createItem(item: any): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      const dc = getDataClient();
      const id = item.id || crypto.randomUUID();
      const newItem = { ...item, id, updated_at: new Date().toISOString() };
      
      await LocalDatabase.init();

      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/products`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
          });
          
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Bridge write failed' }));
            throw new Error(err.message || 'Failed to create product in local bridge');
          }
          
          await LocalDatabase.saveInventoryItem(mapToLocalInventory(newItem, true));
        }
      } else {
        // Web/Cloud fallback: save locally as unsynced first. Only flipped to
        // synced:true below once the direct Supabase write actually succeeds -
        // previously this always saved synced:true here, so an offline create
        // (or one whose online write failed) was silently marked "done" and
        // never retried.
        await LocalDatabase.saveInventoryItem(mapToLocalInventory(newItem, false));

        if (navigator.onLine) {
          try {
            const mapped = {
              id: newItem.id,
              store_id: newItem.store_id || newItem.storeId,
              name: newItem.name || newItem.product_name,
              sku: newItem.sku || null,
              barcode: newItem.barcode || null,
              description: newItem.description || null,
              cost_price: Number(newItem.cost ?? newItem.cost_price ?? 0),
              unit_price: Number(newItem.price ?? newItem.unit_price ?? 0),
              selling_price_2: Number(newItem.selling_price_2 ?? 0),
              selling_price_3: Number(newItem.selling_price_3 ?? 0),
              selling_price_4: Number(newItem.selling_price_4 ?? 0),
              wholesale_price: Number(newItem.wholesale_price ?? 0),
              wholesale_price_ht: Number(newItem.wholesale_price_ht ?? 0),
              wholesale_price_ttc: Number(newItem.wholesale_price_ttc ?? 0),
              quantity: Number(newItem.quantity ?? 0),
              category: (newItem.category && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(newItem.category)) ? newItem.category : (newItem.category_id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(newItem.category_id)) ? newItem.category_id : null,
              image_url: newItem.image_url || null,
              aisle: newItem.aisle || null,
              brand: newItem.brand || null,
              unit_type: newItem.unit_type || null,
              packaging: newItem.packaging || null,
              expiry_date: newItem.expiry_date || null,
              reorder_quantity: Number(newItem.reorder_quantity ?? 0),
              min_quantity: Number(newItem.low_stock_threshold ?? newItem.min_quantity ?? 0),
              version: Number(newItem.version ?? 1),
              created_at: newItem.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { error: supaErr } = await supabase
              .from('products')
              .upsert(mapped);

            if (supaErr) throw supaErr;

            await LocalDatabase.markInventorySynced(newItem.id);
          } catch (supaErr) {
            console.error('[OfflineInventory] Supabase product creation failed, left unsynced for retry:', supaErr);
          }
        }
        // If offline (or the write above failed), the item stays in
        // IndexedDB with synced:false - SyncService.syncUnsyncedInventory()
        // picks it up and pushes it once back online.
      }
      
      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
      return { data: mapDbToInventoryItem(newItem) };
    } catch (error) {
      console.error('[OfflineInventory] Create item error:', error);
      return { error };
    }
  },

  async updateItem(id: string, updates: any): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      await LocalDatabase.init();
      const local = await LocalDatabase.getInventoryItem(id);
      
      const baseItem = local ? mapLocalInventoryToItem(local) : { id } as any;
      const updated = { 
        ...baseItem, 
        ...updates, 
        id, 
        updated_at: new Date().toISOString() 
      };
      
      const dc = getDataClient();
      if (dc.isLocalFirst) {
        await LocalDatabase.saveInventoryItem(mapToLocalInventory(updated, false));

        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/products/${id}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to update product in local bridge');
          }
          await LocalDatabase.saveInventoryItem(mapToLocalInventory(updated, true));
        }
      } else {
        // Web/Cloud fallback: save locally as unsynced first, same rationale
        // as createItem above - only mark synced once the Supabase update
        // actually succeeds.
        await LocalDatabase.saveInventoryItem(mapToLocalInventory(updated, false));

        if (navigator.onLine) {
          try {
            const mappedUpdates: any = {};
            if (updates.name !== undefined) mappedUpdates.name = updates.name;
            if (updates.sku !== undefined) mappedUpdates.sku = updates.sku;
            if (updates.barcode !== undefined) mappedUpdates.barcode = updates.barcode;
            if (updates.description !== undefined) mappedUpdates.description = updates.description;
            if (updates.cost !== undefined) mappedUpdates.cost_price = Number(updates.cost);
            if (updates.cost_price !== undefined) mappedUpdates.cost_price = Number(updates.cost_price);
            if (updates.price !== undefined) mappedUpdates.unit_price = Number(updates.price);
            if (updates.unit_price !== undefined) mappedUpdates.unit_price = Number(updates.unit_price);
            if (updates.selling_price_2 !== undefined) mappedUpdates.selling_price_2 = Number(updates.selling_price_2);
            if (updates.selling_price_3 !== undefined) mappedUpdates.selling_price_3 = Number(updates.selling_price_3);
            if (updates.selling_price_4 !== undefined) mappedUpdates.selling_price_4 = Number(updates.selling_price_4);
            if (updates.wholesale_price !== undefined) mappedUpdates.wholesale_price = Number(updates.wholesale_price);
            if (updates.wholesale_price_ht !== undefined) mappedUpdates.wholesale_price_ht = Number(updates.wholesale_price_ht);
            if (updates.wholesale_price_ttc !== undefined) mappedUpdates.wholesale_price_ttc = Number(updates.wholesale_price_ttc);
            if (updates.quantity !== undefined) mappedUpdates.quantity = Number(updates.quantity);
            if (updates.category !== undefined) {
              mappedUpdates.category = (updates.category && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(updates.category)) ? updates.category : null;
            }
            if (updates.category_id !== undefined) {
              mappedUpdates.category = (updates.category_id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(updates.category_id)) ? updates.category_id : null;
            }
            if (updates.image_url !== undefined) mappedUpdates.image_url = updates.image_url;
            if (updates.aisle !== undefined) mappedUpdates.aisle = updates.aisle;
            if (updates.brand !== undefined) mappedUpdates.brand = updates.brand;
            if (updates.unit_type !== undefined) mappedUpdates.unit_type = updates.unit_type;
            if (updates.packaging !== undefined) mappedUpdates.packaging = updates.packaging;
            if (updates.expiry_date !== undefined) mappedUpdates.expiry_date = updates.expiry_date;
            if (updates.reorder_quantity !== undefined) mappedUpdates.reorder_quantity = Number(updates.reorder_quantity);
            if (updates.low_stock_threshold !== undefined) mappedUpdates.min_quantity = Number(updates.low_stock_threshold);
            if (updates.min_quantity !== undefined) mappedUpdates.min_quantity = Number(updates.min_quantity);
            mappedUpdates.updated_at = new Date().toISOString();

            const { error: supaErr } = await supabase
              .from('products')
              .update(mappedUpdates)
              .eq('id', id);

            if (supaErr) throw supaErr;

            await LocalDatabase.markInventorySynced(id);
          } catch (supaErr) {
            console.error('[OfflineInventory] Supabase update failed, left unsynced for retry:', supaErr);
          }
        }
        // If offline (or the write above failed), the item stays in
        // IndexedDB with synced:false - SyncService.syncUnsyncedInventory()
        // picks it up and pushes it once back online.
      }
      
      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
      return { data: mapDbToInventoryItem(updated) };
    } catch (error) {
      console.error('[OfflineInventory] Update item error:', error);
      return { error };
    }
  },

  async deleteItem(id: string): Promise<{ success: boolean; error?: any }> {
    try {
      await LocalDatabase.init();
      const dc = getDataClient();
      
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/products/${id}`, {
            method: 'DELETE',
            headers
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to delete product in local bridge');
          }
        }
        await LocalDatabase.deleteInventoryItem(id);
      } else {
        // Remove from the local cache immediately (optimistic), but if the
        // Supabase delete doesn't happen right now (offline, or it throws),
        // queue it so SyncService retries it once back online - otherwise
        // the product reappears locally on the next cloud fetch while never
        // actually being removed from Supabase.
        await LocalDatabase.deleteInventoryItem(id);

        let deletedOnline = false;
        if (navigator.onLine) {
          try {
            const { error: supaErr } = await supabase
              .from('products')
              .delete()
              .eq('id', id);

            if (supaErr) throw supaErr;
            deletedOnline = true;
          } catch (supaErr) {
            console.error('[OfflineInventory] Supabase delete failed, queued for retry:', supaErr);
          }
        }

        if (!deletedOnline) {
          await LocalDatabase.addToSyncQueue({
            id: crypto.randomUUID(),
            type: 'inventory_delete',
            data: { id },
            timestamp: Date.now(),
            retries: 0,
          });
        }
      }

      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
      return { success: true };
    } catch (error) {
      console.error('[OfflineInventory] Delete item error:', error);
      return { success: false, error };
    }
  },

  async getProductFamilies(storeId?: string): Promise<{ data?: LocalProductFamily[]; error?: any }> {
    try {
      await LocalDatabase.init();
      const local = await LocalDatabase.getProductFamilies(storeId);
      
      // Background sync families
      const syncFams = async () => {
        let remote: any[] = [];
        const dc = getDataClient();
        try {
          if (dc.isLocalFirst) {
            const headers = await OfflineAuthService.getAuthHeaders();
            if (headers) {
              const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/product_families`, { headers });
              if (res.ok) remote = await res.json();
            }
          } else {
            const { data, error } = await supabase
              .from('product_families')
              .select('*')
              .eq('store_id', storeId);
            if (!error && data) remote = data;
          }
          
          if (remote.length > 0) {
            for (const f of remote) {
              await LocalDatabase.saveProductFamily({
                id: f.id,
                store_id: f.store_id || storeId || '',
                name: f.name,
                description: f.description || undefined,
                parent_id: f.parent_id || undefined,
                created_at: f.created_at || new Date().toISOString(),
                updated_at: f.updated_at || new Date().toISOString(),
                synced: true
              });
            }
          }
        } catch (e) {}
      };
      syncFams();

      return { data: local };
    } catch (error) {
      return { error };
    }
  },

  async getProductBatches(storeId: string, productId: string): Promise<{ data?: any[]; error?: any }> {
    try {
      const dc = getDataClient();
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/product_batches?store_id=${storeId}&product_id=${productId}`, { headers });
          if (res.ok) return { data: await res.json() };
        }
      }
      return { data: [] };
    } catch (error) {
      return { error };
    }
  },

  async getStockValuation(storeId: string): Promise<{ total_cost: number; total_retail: number; total_wholesale: number; total_resale: number; item_count: number; error?: any }> {
    try {
      const dc = getDataClient();
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const sid = storeId === 'all' ? '' : storeId;
          const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/analytics/stock-valuation?store_id=${sid}`, { headers });
          if (res.ok) return await res.json();
        }
      }
      
      // Calculate from LocalDatabase (IndexedDB) for pure cloud mode or fallback
      await LocalDatabase.init();
      const items = await LocalDatabase.getInventory(storeId === 'all' ? undefined : storeId);
      let total_cost = 0;
      let total_retail = 0;
      let total_wholesale = 0;
      let total_resale = 0;
      for (const item of items) {
        const qty = item.quantity || 0;
        const retail = item.unit_price || 0;
        total_cost += (item.cost || 0) * qty;
        total_retail += retail * qty;
        const wholesale = item.wholesale_price || item.wholesale_price_ttc || retail;
        total_wholesale += wholesale * qty;
        const resale = item.selling_price_4 || retail;
        total_resale += resale * qty;
      }
      return {
        total_cost,
        total_retail,
        total_wholesale,
        total_resale,
        item_count: items.length
      };
    } catch (error) {
      console.error('Error fetching stock valuation:', error);
      return { total_cost: 0, total_retail: 0, total_wholesale: 0, total_resale: 0, item_count: 0, error };
    }
  },

  async getLowStockItems(limit: number = 10, storeId?: string): Promise<{ data?: InventoryItem[]; error?: any }> {
    try {
      const dc = getDataClient();
      await LocalDatabase.init();
      const targetStoreId = storeId === 'all' ? undefined : storeId;

      // 1. If Local-First, try Bridge
      if (dc.isLocalFirst) {
        try {
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams({
              filter: 'low_stock',
              limit: String(limit)
            });
            if (targetStoreId) {
              params.append('store_id', targetStoreId);
            }
            const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, { headers });
            if (res.ok) {
              const payload = await res.json();
              const remoteProducts = Array.isArray(payload) ? payload : (payload.data || []);
              const mappedItems = remoteProducts.map(mapDbToInventoryItem);
              return { data: mappedItems.slice(0, limit) };
            }
          }
        } catch (e) {
          console.warn('[OfflineInventory] Bridge getLowStockItems failed, falling back to local cache:', e);
        }
      }

      // 2. Fallback: IndexedDB
      if (targetStoreId) {
        const localInventory = await LocalDatabase.getInventory(targetStoreId);
        const lowStock = localInventory
          .map(mapLocalInventoryToItem)
          .filter(item => item.quantity <= (item.low_stock_threshold || 0));
        return { data: lowStock.slice(0, limit) };
      } else {
        const { OfflineStoreService } = await import('./OfflineStoreService');
        const { data: allStores } = await OfflineStoreService.getStores();
        const storeIds = allStores?.map(s => s.id) || [];
        let combinedLowStock: InventoryItem[] = [];
        for (const sid of storeIds) {
          const localInventory = await LocalDatabase.getInventory(sid);
          const lowStock = localInventory
            .map(mapLocalInventoryToItem)
            .filter(item => item.quantity <= (item.low_stock_threshold || 0));
          combinedLowStock.push(...lowStock);
        }
        return { data: combinedLowStock.slice(0, limit) };
      }
    } catch (error) {
      console.error('[OfflineInventory] getLowStockItems fatal error:', error);
      return { error };
    }
  }
};
