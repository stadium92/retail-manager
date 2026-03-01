/**
 * OfflineInventoryService - Handles inventory operations with offline support
 * Uses 'products' table in Supabase and 'inventory' store in LocalDatabase
 */

import { LocalDatabase, LocalInventory, LocalProductFamily } from './LocalDatabase';
import { InventoryItem, Product } from '@/types';
import { supabase } from '@/integrations/supabase/client';
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
    sub_packaging: product.sub_packaging,
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
    sub_packaging: local.sub_packaging,
    expiry_date: local.expiry_date,
    reorder_quantity: local.reorder_quantity || 0,
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
    sub_packaging: item.sub_packaging,
    expiry_date: item.expiry_date,
    reorder_quantity: Number(item.reorder_quantity) || 0,
    updated_at: item.updated_at || new Date().toISOString(),
    synced,
  };
}

export const OfflineInventoryService = {
  async getInventory(storeId: string, options?: { notify?: boolean }): Promise<{ data?: InventoryItem[]; error?: any }> {
    try {
      const dc = getDataClient();
      await LocalDatabase.init();
      const localInventory = await LocalDatabase.getInventory(storeId);
      
      let remoteProducts: any[] = [];
      let success = false;

      // 1. If Local-First (Worker/Hybrid), try to fetch from Bridge IMMEDIATELY
      if (dc.isLocalFirst) {
        try {
          const { OfflineAuthService } = await import('./OfflineAuthService');
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams();
            if (storeId) params.set('store_id', storeId);
            const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, { headers });
            if (res.ok) {
              const payload = await res.json();
              remoteProducts = Array.isArray(payload) ? payload : payload.data || [];
              console.log('[OfflineInventory] Bridge products fetched:', remoteProducts.length);
              success = true;
            }
          }
        } catch (e) {
          console.warn('[OfflineInventory] Bridge fetch failed, using local DB:', e);
        }
      }

      // 2. If we got fresh data from Bridge, update LocalDatabase and return it
      if (success && remoteProducts.length > 0) {
        // Reconcile Deletions
        const remoteIds = new Set(remoteProducts.map((p: any) => p.id));
        for (const local of localInventory) {
          if (local.synced && !remoteIds.has(local.id)) {
            await LocalDatabase.deleteInventoryItem(local.id);
          }
        }
        
        // Reconcile Updates/Adds
        const mappedItems: InventoryItem[] = [];
        for (const remote of remoteProducts) {
          const mapped = mapDbToInventoryItem(remote);
          await LocalDatabase.saveInventoryItem(mapToLocalInventory(remote, true));
          mappedItems.push(mapped);
        }

        if (options?.notify !== false) {
          window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
        }

        return { data: mappedItems };
      }

      // 3. Fallback: Return what we have in LocalDatabase
      if (localInventory.length > 0) {
        return { data: localInventory.map(mapLocalInventoryToItem) };
      }

      // 4. If Local-First failed and DB empty, OR if Online Mode: Background sync from Supabase
      if (!dc.isLocalFirst && navigator.onLine) {
        const { data, error } = await supabase.from('products').select('*').eq('store_id', storeId).order('name');
        if (data) {
            const mapped = data.map(mapDbToInventoryItem);
            // Sync to local DB in background
            for (const item of data) {
                await LocalDatabase.saveInventoryItem(mapToLocalInventory(item, true));
            }
            return { data: mapped };
        }
        if (error) throw error;
      }

      return { data: [] };
    } catch (error) {
      console.error('getInventory error:', error);
      return { error };
    }
  },

  async getInventoryItem(id: string): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      await LocalDatabase.init();
      const local = await LocalDatabase.getInventoryItem(id);
      if (local) return { data: mapLocalInventoryToItem(local) };

      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error) return { error };
      return { data: mapDbToInventoryItem(data) };
    } catch (error) {
      return { error };
    }
  },

  async createItem(item: any): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      const id = crypto.randomUUID();
      const newItem = { ...item, id, updated_at: new Date().toISOString() };
      
      await LocalDatabase.init();
      await LocalDatabase.saveInventoryItem(mapToLocalInventory(newItem, false));
      
      await SyncService.addToQueue({
        type: 'inventory_update',
        data: newItem
      });

      return { data: mapLocalInventoryToItem(mapToLocalInventory(newItem, false)) };
    } catch (error) {
      console.error('Create item error:', error);
      return { error };
    }
  },

  async updateItem(id: string, updates: any): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      await LocalDatabase.init();
      const local = await LocalDatabase.getInventoryItem(id);
      
      // Ensure we merge with local data to not lose fields
      const updated = { 
        ...mapLocalInventoryToItem(local || {} as any), 
        ...updates, 
        id, 
        updated_at: new Date().toISOString() 
      };
      
      await LocalDatabase.saveInventoryItem(mapToLocalInventory(updated, false));
      
      await SyncService.addToQueue({
        type: 'inventory_update',
        data: updated
      });

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
      
      await SyncService.addToQueue({
        type: 'inventory_delete',
        data: { id }
      });

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
          } else if (navigator.onLine) {
            const { data } = await supabase.from('product_families').select('*');
            if (data) remote = data;
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
