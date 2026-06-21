/**
 * OfflineInventoryService - Handles inventory operations with offline support
 * Uses 'products' table in Supabase and 'inventory' store in LocalDatabase
 */

import { LocalDatabase, LocalInventory, LocalProductFamily } from './LocalDatabase';
import { InventoryItem, Product } from '@/types';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';
import { SyncService } from './SyncService';
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
    aisle: product.aisle,
    brand: product.brand,
    unit_type: product.unit_type,
    packaging: product.packaging,
    expiry_date: product.expiry_date,
    reorder_quantity: Number(product.reorder_quantity) || 0,
    low_stock_threshold: Number(product.low_stock_threshold ?? product.min_quantity ?? 0),
    image_url: product.image_url,
    prep_time_minutes: Number(product.prep_time_minutes) || 0,
    is_available: product.is_available === 1 || product.is_available === true,
    allergens: typeof product.allergens === 'string' ? JSON.parse(product.allergens || '[]') : (product.allergens || []),
    course_type: product.course_type || '',
    modifiers: typeof product.modifiers === 'string' ? JSON.parse(product.modifiers || '[]') : (product.modifiers || []),
    item_type: product.item_type || 'product',
    pack_items: typeof product.pack_items === 'string' ? JSON.parse(product.pack_items || '[]') : (product.pack_items || []),
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
    aisle: local.aisle,
    brand: local.brand,
    unit_type: local.unit_type,
    packaging: local.packaging,
    expiry_date: local.expiry_date,
    reorder_quantity: local.reorder_quantity || 0,
    low_stock_threshold: local.low_stock_threshold ?? 0,
    prep_time_minutes: Number(local.prep_time_minutes) || 0,
    is_available: local.is_available === 1 || local.is_available === true,
    allergens: typeof local.allergens === 'string' ? JSON.parse(local.allergens || '[]') : (local.allergens || []),
    course_type: local.course_type || '',
    modifiers: typeof local.modifiers === 'string' ? JSON.parse(local.modifiers || '[]') : (local.modifiers || []),
    item_type: (local as any).item_type || 'product',
    pack_items: typeof (local as any).pack_items === 'string' ? JSON.parse((local as any).pack_items || '[]') : ((local as any).pack_items || []),
    updated_at: local.updated_at,
    created_at: (local as any).created_at || local.updated_at,
  };
}

function mapToLocalInventory(item: InventoryItem | any, synced: boolean = true): LocalInventory {
  return {
    id: item.id,
    store_id: item.store_id,
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
    aisle: item.aisle,
    brand: item.brand,
    unit_type: item.unit_type,
    packaging: item.packaging,
    expiry_date: item.expiry_date,
    reorder_quantity: Number(item.reorder_quantity) || 0,
    low_stock_threshold: Number(item.low_stock_threshold ?? item.min_quantity ?? 0),
    prep_time_minutes: Number(item.prep_time_minutes) || 0,
    is_available: item.is_available === false ? false : true,
    allergens: typeof item.allergens === 'string' ? item.allergens : JSON.stringify(item.allergens || []),
    course_type: item.course_type || '',
    modifiers: typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers || []),
    item_type: item.item_type || 'product',
    pack_items: typeof item.pack_items === 'string' ? item.pack_items : JSON.stringify(item.pack_items || []),
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

      // 1. If Pure Cloud mode (not local-first) and online, fetch directly from Supabase
      if (!dc.isLocalFirst && navigator.onLine) {
        try {
          let query = supabase
            .from('menu_items')
            .select('*')
            .is('deleted_at', null)
            .order('name');
            
          if (targetStoreId) {
            query = query.eq('restaurant_id', targetStoreId);
          }
          
          const { data, error } = await query;
          if (error) throw error;
          
          if (data) {
            const mapped = data.map(mapDbToInventoryItem);
            
            // Cache remote items to IndexedDB asynchronously without blocking UI
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

      // 2. If Local-First, try Bridge as the absolute source of truth
      if (dc.isLocalFirst) {
        try {
          const { OfflineAuthService } = await import('./OfflineAuthService');
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

      // 3. Fallback: retrieve from IndexedDB
      const localInventory = await LocalDatabase.getInventory(targetStoreId);
      if (localInventory.length > 0 && !dc.isLocalFirst) {
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
            .from('menu_items')
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
        const { OfflineAuthService } = await import('./OfflineAuthService');
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          // 1. Write to Bridge FIRST
          const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/products`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
          });
          
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Bridge write failed' }));
            await LocalDatabase.deleteInventoryItem(id);
            window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
            throw new Error(err.message || 'Failed to create product in local bridge');
          }
          
          await LocalDatabase.saveInventoryItem(mapToLocalInventory(newItem, true));
          
          window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
          return { data: mapDbToInventoryItem(newItem) };
        }
      } else {
        await LocalDatabase.saveInventoryItem(mapToLocalInventory(newItem, true));

        if (navigator.onLine) {
          try {
            const mapped = {
              id: newItem.id,
              restaurant_id: newItem.store_id || newItem.storeId,
              name: newItem.name || newItem.product_name,
              sku: newItem.sku || null,
              barcode: newItem.barcode || null,
              description: newItem.description || null,
              cost_price: Number(newItem.cost_price ?? newItem.cost ?? 0),
              unit_price: Number(newItem.unit_price ?? newItem.price ?? 0),
              selling_price_2: Number(newItem.selling_price_2 ?? 0),
              selling_price_3: Number(newItem.selling_price_3 ?? 0),
              selling_price_4: Number(newItem.selling_price_4 ?? 0),
              wholesale_price_ht: Number(newItem.wholesale_price_ht ?? 0),
              wholesale_price_ttc: Number(newItem.wholesale_price_ttc ?? 0),
              quantity: Number(newItem.quantity ?? 0),
              category: newItem.category || null,
              image_url: newItem.image_url || null,
              unit_type: newItem.unit_type || null,
              packaging: newItem.packaging || null,
              prep_time_minutes: Number(newItem.prep_time_minutes ?? 0),
              is_available: newItem.is_available !== false && newItem.is_available !== 0,
              allergens: Array.isArray(newItem.allergens) ? newItem.allergens : (newItem.allergens ? [newItem.allergens] : []),
              course_type: newItem.course_type || null,
              modifiers: Array.isArray(newItem.modifiers) ? newItem.modifiers : (newItem.modifiers ? [newItem.modifiers] : []),
              version: Number(newItem.version ?? 1),
              created_at: newItem.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { error: supaErr } = await supabase
              .from('menu_items')
              .upsert(mapped);

            if (supaErr) {
              console.error('[OfflineInventory] Supabase product creation failed:', supaErr);
            }
          } catch (supaErr) {
            console.error('[OfflineInventory] Supabase product creation exception:', supaErr);
          }
        }
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
        }
      } else {
        await LocalDatabase.saveInventoryItem(mapToLocalInventory(updated, true));

        if (navigator.onLine) {
          try {
            const mapped = {
              id: updated.id,
              restaurant_id: updated.store_id || baseItem.store_id,
              name: updated.name || baseItem.name,
              sku: updated.sku !== undefined ? updated.sku : (baseItem.sku || null),
              barcode: updated.barcode !== undefined ? updated.barcode : (baseItem.barcode || null),
              description: updated.description !== undefined ? updated.description : (baseItem.description || null),
              cost_price: Number(updated.cost_price ?? updated.cost ?? baseItem.cost_price ?? baseItem.cost ?? 0),
              unit_price: Number(updated.unit_price ?? updated.price ?? baseItem.unit_price ?? baseItem.price ?? 0),
              selling_price_2: Number(updated.selling_price_2 ?? baseItem.selling_price_2 ?? 0),
              selling_price_3: Number(updated.selling_price_3 ?? baseItem.selling_price_3 ?? 0),
              selling_price_4: Number(updated.selling_price_4 ?? baseItem.selling_price_4 ?? 0),
              wholesale_price_ht: Number(updated.wholesale_price_ht ?? baseItem.wholesale_price_ht ?? 0),
              wholesale_price_ttc: Number(updated.wholesale_price_ttc ?? baseItem.wholesale_price_ttc ?? 0),
              quantity: Number(updated.quantity ?? baseItem.quantity ?? 0),
              category: updated.category !== undefined ? updated.category : (baseItem.category || null),
              image_url: updated.image_url !== undefined ? updated.image_url : (baseItem.image_url || null),
              unit_type: updated.unit_type !== undefined ? updated.unit_type : (baseItem.unit_type || null),
              packaging: updated.packaging !== undefined ? updated.packaging : (baseItem.packaging || null),
              prep_time_minutes: Number(updated.prep_time_minutes ?? baseItem.prep_time_minutes ?? 0),
              is_available: updated.is_available !== false && updated.is_available !== 0,
              allergens: Array.isArray(updated.allergens) ? updated.allergens : (updated.allergens ? [updated.allergens] : (baseItem.allergens || [])),
              course_type: updated.course_type !== undefined ? updated.course_type : (baseItem.course_type || null),
              modifiers: Array.isArray(updated.modifiers) ? updated.modifiers : (updated.modifiers ? [updated.modifiers] : (baseItem.modifiers || [])),
              version: Number(updated.version ?? baseItem.version ?? 1),
              updated_at: new Date().toISOString(),
            };

            const { error: supaErr } = await supabase
              .from('menu_items')
              .upsert(mapped);

            if (supaErr) {
              console.error('[OfflineInventory] Supabase product update failed:', supaErr);
            }
          } catch (supaErr) {
            console.error('[OfflineInventory] Supabase product update exception:', supaErr);
          }
        }
      }

      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
      return { data: updated as InventoryItem };
    } catch (error) {
      console.error('Update item error:', error);
      return { error };
    }
  },

  async deleteItem(id: string): Promise<{ error?: any }> {
    try {
      await LocalDatabase.init();
      await LocalDatabase.deleteInventoryItem(id);

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
      } else {
        if (navigator.onLine) {
          try {
            const { error: supaErr } = await supabase
              .from('menu_items')
              .delete()
              .eq('id', id);

            if (supaErr) {
              console.error('[OfflineInventory] Supabase product deletion failed:', supaErr);
            }
          } catch (supaErr) {
            console.error('[OfflineInventory] Supabase product deletion exception:', supaErr);
          }
        }
      }

      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
      return {};
    } catch (error) {
      return { error };
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
              .eq('restaurant_id', storeId);
            if (!error && data) remote = data;
          }
          
          if (remote.length > 0) {
            for (const f of remote) {
              await LocalDatabase.saveProductFamily({
                id: f.id,
                store_id: f.restaurant_id || f.store_id || storeId || '',
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

  async getStockValuation(storeId: string): Promise<{ total_cost: number; total_retail: number; item_count: number; error?: any }> {
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
      for (const item of items) {
        total_cost += (item.cost || 0) * (item.quantity || 0);
        total_retail += (item.unit_price || item.price || 0) * (item.quantity || 0);
      }
      return {
        total_cost,
        total_retail,
        item_count: items.length
      };
    } catch (error) {
      console.error('Error fetching stock valuation:', error);
      return { total_cost: 0, total_retail: 0, item_count: 0, error };
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
          .filter(item => item.quantity > 0 && item.quantity <= (item.low_stock_threshold || 0));
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
            .filter(item => item.quantity > 0 && item.quantity <= (item.low_stock_threshold || 0));
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
