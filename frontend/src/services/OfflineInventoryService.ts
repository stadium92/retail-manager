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
    low_stock_threshold: Number(product.min_quantity || product.low_stock_threshold) || 10,
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
    low_stock_threshold: local.low_stock_threshold || 10,
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
    low_stock_threshold: Number(item.low_stock_threshold || item.min_quantity) || 10,
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
              
              // FORCE RECONCILIATION: Bridge is the absolute truth.
              // We wipe the local cache for this store and replace it.
              const reconcileCache = async () => {
                  try {
                      // 1. Clear existing local inventory for this store
                      await LocalDatabase.clearTable('inventory'); 
                      
                      // 2. Save fresh data from bridge
                      for (const remote of remoteProducts) {
                          await LocalDatabase.saveInventoryItem(mapToLocalInventory(remote, true));
                      }
                      console.log('[OfflineInventory] Cache reconciled with bridge truth');
                  } catch (err) {
                      console.error('[OfflineInventory] Reconciliation failed:', err);
                  }
              };
              reconcileCache();
              
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

      // 2. Fallback: ONLY use local cache if NOT in local-first mode
      // If we are in local-first mode and the bridge failed, we SHOULD NOT show stale browser cache
      if (!dc.isLocalFirst) {
          const localInventory = await LocalDatabase.getInventory(storeId);
          if (localInventory.length > 0) {
            return { data: localInventory.map(mapLocalInventoryToItem) };
          }
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
  }
};
