/**
 * OfflineInventoryService - Handles inventory operations with offline support
 * Uses 'products' table in Supabase and 'inventory' store in LocalDatabase
 */

import { LocalDatabase, LocalInventory, LocalProductFamily } from './LocalDatabase';
import { InventoryItem, Product } from '@/types';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';
import { SyncService } from './SyncService';

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
    updated_at: item.updated_at || new Date().toISOString(),
    synced,
  };
}

export const OfflineInventoryService = {
  async getInventory(storeId: string, options?: { notify?: boolean }): Promise<{ data?: InventoryItem[]; error?: any }> {
    try {
      const dc = getDataClient();
      await LocalDatabase.init();
      
      // 1. If Local-First, try Bridge as the absolute source of truth
      if (dc.isLocalFirst) {
        try {
          const { OfflineAuthService } = await import('./OfflineAuthService');
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams({ store_id: storeId });
            const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, { headers });
            if (res.ok) {
              const payload = await res.json();
              const remoteProducts = Array.isArray(payload) ? payload : (payload.data || []);
              const mappedItems = remoteProducts.map(mapDbToInventoryItem);
              
              // NO CACHE SYNC: We rely purely on the Local Bridge to avoid "Ghost Files".
              // Browser IndexedDB is now ONLY used as an emergency read-only fallback.
              
              // Update cache without blocking
              

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

      // 2. Emergency Fallback: ONLY use IndexedDB if bridge is literally offline
      const localInventory = await LocalDatabase.getInventory(storeId);
      if (localInventory.length > 0 && !dc.isLocalFirst) {
        return { data: localInventory.map(mapLocalInventoryToItem) };
      }
      // If we are Local-First and bridge failed, we must NOT show ghost data from browser
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
          
          // 2. Successful bridge write -> update local cache as "synced"
          await LocalDatabase.saveInventoryItem(mapToLocalInventory(newItem, true));
          
          window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
          return { data: mapDbToInventoryItem(newItem) };
        }
      }

      // Fallback for true offline or non-local-first
      await LocalDatabase.saveInventoryItem(mapToLocalInventory(newItem, false));
      if (!dc.isLocalFirst) {
          await SyncService.addToQueue({ type: 'inventory_update', data: newItem });
      }
      
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
      
      // Ensure we merge with local data to not lose fields
      const baseItem = local ? mapLocalInventoryToItem(local) : { id } as any;
      const updated = { 
        ...baseItem, 
        ...updates, 
        id, 
        updated_at: new Date().toISOString() 
      };
      
      await LocalDatabase.saveInventoryItem(mapToLocalInventory(updated, false));

      const dc = getDataClient();
      if (dc.isLocalFirst) {
        // Forward update to local bridge
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
        // Online mode: sync directly to Supabase
        await SyncService.addToQueue({
          type: 'inventory_update',
          data: updated
        });
      }

      // Centralized event dispatch
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
        // Forward deletion to local bridge
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
        // Online mode: sync directly to Supabase
        await SyncService.addToQueue({
          type: 'inventory_delete',
          data: { id }
        });
      }

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
          }
          
          if (remote.length > 0) {
            for (const f of remote) {
              await LocalDatabase.saveProductFamily({ ...f, synced: true });
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
      // Sum local fallback if needed (simplified)
      return { total_cost: 0, total_retail: 0, item_count: 0 };
    } catch (error) {
      console.error('Error fetching stock valuation:', error);
      return { total_cost: 0, total_retail: 0, item_count: 0, error };
    }
  }
};
