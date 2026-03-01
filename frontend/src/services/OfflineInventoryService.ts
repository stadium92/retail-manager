/**
 * OfflineInventoryService - Handles inventory operations with backend-first priority
 */

import { LocalDatabase, LocalInventory } from './LocalDatabase';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';

export interface InventoryItem {
  id: string;
  store_id: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  cost_price: number;
  unit_price: number;
  wholesale_price?: number;
  wholesale_price_ht?: number;
  wholesale_price_ttc?: number;
  selling_price_2?: number;
  selling_price_3?: number;
  selling_price_4?: number;
  min_quantity: number;
  quantity: number;
  category?: string;
  category_name?: string;
  image_url?: string;
  aisle?: string;
  brand?: string;
  unit_type?: string;
  packaging?: string;
  expiry_date?: string;
  reorder_quantity?: number;
  low_stock_threshold?: number;
  created_at?: string;
  updated_at: string;
  synced?: boolean;
}

function mapLocalInventoryToItem(local: any): InventoryItem {
  if (!local) return {} as InventoryItem;
  return {
    ...local,
    id: local.id, // ENSURE ID IS PRESENT
    store_id: local.store_id,
    name: local.name || local.product_name || 'Sans nom',
    cost_price: Number(local.cost_price ?? local.cost ?? 0),
    unit_price: Number(local.unit_price ?? local.price ?? 0),
    wholesale_price: Number(local.wholesale_price || 0),
    wholesale_price_ht: Number(local.wholesale_price_ht || 0),
    wholesale_price_ttc: Number(local.wholesale_price_ttc || 0),
    quantity: Number(local.quantity || 0),
    low_stock_threshold: Number(local.low_stock_threshold || local.min_quantity || 0),
    updated_at: local.updated_at || new Date().toISOString(),
  } as InventoryItem;
}

function mapToLocalInventory(item: any, synced: boolean = true): LocalInventory {
  if (!item || !item.id) {
      console.error("LocalDatabase: Attempted to map item without ID", item);
      throw new Error("Item ID is required for storage");
  }
  
  return {
    id: item.id,
    store_id: item.store_id,
    name: item.name || item.product_name || 'Sans nom',
    sku: item.sku,
    barcode: item.barcode,
    description: item.description,
    cost_price: Number(item.cost_price ?? item.cost ?? item.price ?? 0),
    unit_price: Number(item.unit_price ?? item.price ?? 0),
    wholesale_price: Number(item.wholesale_price || 0),
    wholesale_price_ht: Number(item.wholesale_price_ht || 0),
    wholesale_price_ttc: Number(item.wholesale_price_ttc || 0),
    selling_price_2: Number(item.selling_price_2 || 0),
    selling_price_3: Number(item.selling_price_3 || 0),
    selling_price_4: Number(item.selling_price_4 || 0),
    min_quantity: Number(item.min_quantity || 0),
    quantity: Number(item.quantity || 0),
    category: item.category || item.category_id,
    image_url: item.image_url,
    aisle: item.aisle,
    brand: item.brand,
    unit_type: item.unit_type,
    packaging: item.packaging,
    expiry_date: item.expiry_date,
    reorder_quantity: Number(item.reorder_quantity || 0),
    low_stock_threshold: Number(item.low_stock_threshold || item.min_quantity || 0),
    created_at: item.created_at,
    updated_at: item.updated_at || new Date().toISOString(),
    synced,
  } as LocalInventory;
}

export const OfflineInventoryService = {
  async getInventory(storeId: string, options?: { notify?: boolean }) {
    try {
      await LocalDatabase.init();
      const dc = getDataClient();
      
      // BACKEND FIRST
      if (dc.isLocalFirst) {
        try {
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/products?store_id=${storeId}`, { headers });
            if (res.ok) {
              const remoteProducts = await res.json();
              
              const localInventory = await LocalDatabase.getInventory(storeId);
              for (const remote of remoteProducts) {
                if (!remote || !remote.id) continue;
                const localMatch = localInventory.find(l => l.id === remote.id);
                if (!localMatch || localMatch.synced) {
                  await LocalDatabase.saveInventoryItem(mapToLocalInventory(remote, true));
                }
              }
              return { data: remoteProducts.map(mapLocalInventoryToItem) };
            }
          }
        } catch (e) {
          console.error("Inventory fetch failed:", e);
        }
      }

      const finalLocal = await LocalDatabase.getInventory(storeId);
      return { data: finalLocal.map(mapLocalInventoryToItem) };
    } catch (error) {
      return { error };
    }
  },

  async getProductFamilies(storeId: string) {
    try {
      await LocalDatabase.init();
      const dc = getDataClient();
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/product_families?store_id=${storeId}`, { headers });
          if (res.ok) return { data: await res.json() };
        }
      }
      const local = await LocalDatabase.getProductFamilies(storeId);
      return { data: local };
    } catch (error) {
      return { error };
    }
  },

  async createItem(product: any) {
    const dc = getDataClient();
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/products`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data && data.id) {
        await LocalDatabase.saveInventoryItem(mapToLocalInventory(data, true));
      }
      return { data };
    } catch (error) {
      return { error };
    }
  },

  async updateItem(id: string, product: any) {
    const dc = getDataClient();
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/products/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data && data.id) {
        await LocalDatabase.saveInventoryItem(mapToLocalInventory(data, true));
      }
      return { data };
    } catch (error) {
      return { error };
    }
  },

  async deleteItem(id: string) {
    const dc = getDataClient();
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      await fetch(`${dc.localBridgeBaseUrl}/rest/v1/products/${id}`, { method: 'DELETE', headers });
      await LocalDatabase.deleteInventoryItem(id);
      return { data: true };
    } catch (error) {
      return { error };
    }
  }
};
