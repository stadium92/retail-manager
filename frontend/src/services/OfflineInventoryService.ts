/**
 * OfflineInventoryService - Handles inventory operations with offline support
 * Uses 'products' table in Supabase and 'inventory' store in LocalDatabase
 */

import { LocalDatabase, LocalInventory, LocalProductFamily } from './LocalDatabase';
import { supabase } from '@/integrations/supabase/client';
import { InventoryItem } from '@/types';
import { toast } from '@/hooks/use-toast';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';

type TimeoutResult<T> =
  | { timedOut: true; promise: Promise<T> }
  | { timedOut: false; value: T };

async function raceWithSoftTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<TimeoutResult<T>> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<{ __timeout: true }>((resolve) => {
    timeoutId = window.setTimeout(() => resolve({ __timeout: true }), timeoutMs);
  });

  const result = await Promise.race([promise, timeoutPromise]);
  if (timeoutId) window.clearTimeout(timeoutId);

  if ((result as any)?.__timeout) {
    return { timedOut: true, promise };
  }

  return { timedOut: false, value: result as T };
}

function mapLocalInventoryToItem(item: LocalInventory): InventoryItem {
  return {
    id: item.id,
    name: item.product_name,
    description: undefined,
    sku: item.sku,
    price: item.unit_price,
    wholesale_price: item.wholesale_price,
    wholesale_price_ht: item.wholesale_price_ht,
    wholesale_price_ttc: item.wholesale_price_ttc,
    cost: item.cost,
    quantity: item.quantity,
    low_stock_threshold: 10,
    store_id: item.store_id,
    image_url: undefined,
    aisle: item.aisle,
    brand: item.brand,
    unit_type: item.unit_type,
    packaging: item.packaging,
    expiry_date: item.expiry_date,
    reorder_quantity: item.reorder_quantity,
    created_at: item.updated_at,
    updated_at: item.updated_at,
  } as InventoryItem;
}

function mapDbToInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    price: Number(row.unit_price) || 0,
    wholesale_price: Number(row.wholesale_price) || 0,
    wholesale_price_ht: Number(row.wholesale_price_ht) || 0,
    wholesale_price_ttc: Number(row.wholesale_price_ttc) || 0,
    cost: Number(row.cost_price) || 0,
    quantity: row.quantity,
    low_stock_threshold: row.min_quantity,
    category_id: row.category,
    store_id: row.store_id,
    image_url: row.image_url,
    aisle: row.aisle,
    brand: row.brand,
    unit_type: row.unit_type,
    packaging: row.packaging,
    expiry_date: row.expiry_date,
    reorder_quantity: row.reorder_quantity,
    created_at: row.created_at,
    updated_at: row.updated_at,
  } as InventoryItem;
}

function mapInventoryItemToLocal(item: InventoryItem, synced: boolean): LocalInventory {
  return {
    id: item.id,
    store_id: item.store_id,
    product_name: item.name,
    sku: item.sku,
    quantity: item.quantity,
    unit_price: item.price,
    wholesale_price: item.wholesale_price,
    wholesale_price_ht: item.wholesale_price_ht,
    wholesale_price_ttc: item.wholesale_price_ttc,
    cost: item.cost,
    category: item.category_id,
    aisle: item.aisle,
    brand: item.brand,
    unit_type: item.unit_type,
    packaging: item.packaging,
    expiry_date: item.expiry_date,
    reorder_quantity: item.reorder_quantity,
    updated_at: item.updated_at || new Date().toISOString(),
    synced,
  };
}

export class OfflineInventoryService {
  /**
   * Get all inventory items (merges local and remote with soft timeout)
   */
  static async getInventory(
    storeId?: string,
    options?: { notify?: boolean; timeoutMs?: number }
  ): Promise<{ data?: InventoryItem[]; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const params = new URLSearchParams();
          if (storeId) params.set('store_id', storeId);
          const response = await fetch(
            `${dataClient.localBridgeBaseUrl}/rest/v1/products?${params.toString()}`,
            { headers }
          );
          if (response.ok) {
            const payload = await response.json().catch(() => []);
            const items = (payload || []).map(mapDbToInventoryItem);
            await LocalDatabase.init();
            const localInventory = await LocalDatabase.getInventory(storeId);
            await OfflineInventoryService.cacheRemoteProducts(payload || [], localInventory);
            if (options?.notify !== false) {
              window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
            }
            return { data: items };
          }
        }
      }

      await LocalDatabase.init();
      const localInventory = await LocalDatabase.getInventory(storeId);
      const localAsItems = localInventory.map(mapLocalInventoryToItem);

      if (!navigator.onLine) {
        return { data: localAsItems };
      }

      // Fetch from server (products table) with timeout
      const fetchRemote = async (): Promise<{ data: any[] | null; error: any }> => {
        let query = supabase.from('products').select('*');
        if (storeId) {
          query = query.eq('store_id', storeId);
        }
        const { data, error } = await query.order('name');
        return { data, error };
      };

      const remoteResult = await raceWithSoftTimeout(fetchRemote(), options?.timeoutMs ?? 4500);

      if (remoteResult.timedOut) {
        // Return local immediately; still cache remote results if/when they arrive
        remoteResult.promise
          .then(async (result) => {
            if (result.error || !result.data) return;
            await OfflineInventoryService.cacheRemoteProducts(result.data, localInventory);
            if (options?.notify !== false) {
              window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
            }
          })
          .catch(() => {
            /* ignore */
          });

        return { data: localAsItems };
      }

      // TypeScript narrowing: if not timedOut, value exists
      const { data: remoteProducts, error } = (remoteResult as { timedOut: false; value: { data: any[] | null; error: any } }).value;

      if (error) {
        console.error('Failed to fetch remote products:', error);
        return { data: localAsItems };
      }

      await this.cacheRemoteProducts(remoteProducts || [], localInventory);
      if (options?.notify !== false) {
        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
      }

      // Merge local unsynced with remote
      const unsyncedLocalIds = new Set(localInventory.filter(i => !i.synced).map(i => i.id));
      const mergedById = new Map<string, InventoryItem>();
      for (const item of localAsItems) mergedById.set(item.id, item);
      for (const product of remoteProducts || []) {
        if (!unsyncedLocalIds.has(product.id)) {
          mergedById.set(product.id, mapDbToInventoryItem(product));
        }
      }

      return { data: Array.from(mergedById.values()) };
    } catch (error) {
      console.error('Get inventory error:', error);
      return { error };
    }
  }

  private static async cacheRemoteProducts(remoteProducts: any[], localInventory: LocalInventory[]) {
    for (const product of remoteProducts || []) {
      const existingLocal = localInventory.find(i => i.id === product.id);
      if (existingLocal && !existingLocal.synced) continue;

      await LocalDatabase.saveInventoryItem({
        id: product.id,
        store_id: product.store_id,
        product_name: product.name,
        sku: product.sku || undefined,
        quantity: product.quantity,
        unit_price: Number(product.unit_price) || 0,
        wholesale_price: Number(product.wholesale_price) || 0,
        cost: Number(product.cost_price) || 0,
        category: product.category || undefined,
        updated_at: product.updated_at || product.created_at,
        synced: true,
      });
    }
  }

  /**
   * Create an inventory item (works offline)
   */
  static async createItem(
    data: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ data?: InventoryItem; error?: any }> {
    const itemId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({
              store_id: data.store_id,
              name: data.name,
              description: data.description,
              sku: data.sku,
              unit_price: data.price,
              wholesale_price: data.wholesale_price,
              wholesale_price_ht: data.wholesale_price_ht,
              wholesale_price_ttc: data.wholesale_price_ttc,
              cost_price: data.cost,
              quantity: data.quantity,
              min_quantity: data.low_stock_threshold,
              category: data.category_id,
              image_url: data.image_url,
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) return { error: payload };

          const created = payload ? mapDbToInventoryItem(payload) : undefined;
          if (created) {
            await LocalDatabase.init();
            await LocalDatabase.saveInventoryItem(mapInventoryItemToLocal(created, true));
            await LocalDatabase.addToSyncQueue({
              id: crypto.randomUUID(),
              type: 'pending_mutation',
              data: {
                supabase_service_key: '',
                entity: 'products',
                payload: payload,
                store_id: payload?.store_id || data.store_id,
              },
              timestamp: Date.now(),
              retries: 0,
            });
          }
          return { data: created };
        }
      }

      await LocalDatabase.init();

      const localItem: LocalInventory = {
        id: itemId,
        store_id: data.store_id,
        product_name: data.name,
        sku: data.sku,
        quantity: data.quantity,
        unit_price: data.price,
        wholesale_price: data.wholesale_price,
        wholesale_price_ht: data.wholesale_price_ht,
        wholesale_price_ttc: data.wholesale_price_ttc,
        cost: data.cost,
        category: undefined,
        updated_at: now,
        synced: false,
      };

      await LocalDatabase.saveInventoryItem(localItem);

      if (!navigator.onLine) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'inventory_update',
          data: { ...data, id: itemId, created_at: now },
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: 'Item Created (Offline)',
          description: 'Will sync when back online.',
        });

        return {
          data: {
            id: itemId,
            ...data,
            created_at: now,
            updated_at: now,
          } as InventoryItem,
        };
      }

      // Try to sync immediately (to products table)
      const { data: remoteProduct, error } = await supabase
        .from('products')
        .insert({
          id: itemId,
          store_id: data.store_id,
          name: data.name,
          description: data.description,
          sku: data.sku,
          unit_price: data.price,
          wholesale_price: data.wholesale_price,
          wholesale_price_ht: data.wholesale_price_ht,
          wholesale_price_ttc: data.wholesale_price_ttc,
          cost_price: data.cost,
          quantity: data.quantity,
          min_quantity: data.low_stock_threshold,
          image_url: data.image_url,
        })
        .select()
        .single();

      if (error) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'inventory_update',
          data: { ...data, id: itemId, created_at: now },
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: 'Item Created Locally',
          description: 'Server sync failed, will retry later.',
          variant: 'destructive',
        });

        return {
          data: {
            id: itemId,
            ...data,
            created_at: now,
            updated_at: now,
          } as InventoryItem,
        };
      }

      await LocalDatabase.markInventoryItemSynced(itemId);
      return { data: remoteProduct ? mapDbToInventoryItem(remoteProduct) : undefined };
    } catch (error) {
      console.error('Create item error:', error);
      return { error };
    }
  }

  /**
   * Update an inventory item (works offline)
   */
  static async updateItem(
    id: string,
    updates: Partial<InventoryItem>
  ): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/products/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({
              name: updates.name,
              description: updates.description,
              sku: updates.sku,
              unit_price: updates.price,
              wholesale_price: updates.wholesale_price,
              wholesale_price_ht: updates.wholesale_price_ht,
              wholesale_price_ttc: updates.wholesale_price_ttc,
              cost_price: updates.cost,
              quantity: updates.quantity,
              min_quantity: updates.low_stock_threshold,
              category: updates.category_id,
              image_url: updates.image_url,
              store_id: updates.store_id,
            }),
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) return { error: payload };

          const updated = payload ? mapDbToInventoryItem(payload) : undefined;
          if (updated) {
            await LocalDatabase.init();
            await LocalDatabase.saveInventoryItem(mapInventoryItemToLocal(updated, true));
          }
          await LocalDatabase.addToSyncQueue({
            id: crypto.randomUUID(),
            type: 'pending_mutation',
            data: {
              supabase_service_key: '',
              entity: 'products',
              payload: payload,
              store_id: payload?.store_id || updates.store_id,
            },
            timestamp: Date.now(),
            retries: 0,
          });
          return { data: updated };
        }
      }

      await LocalDatabase.init();
      const now = new Date().toISOString();

      const existingItem = await LocalDatabase.getInventoryItem(id);

      const localItem: LocalInventory = {
        id,
        store_id: updates.store_id || existingItem?.store_id || '',
        product_name: updates.name || existingItem?.product_name || '',
        sku: updates.sku || existingItem?.sku,
        quantity: updates.quantity ?? existingItem?.quantity ?? 0,
        unit_price: updates.price ?? existingItem?.unit_price ?? 0,
        wholesale_price: updates.wholesale_price ?? existingItem?.wholesale_price ?? 0,
        wholesale_price_ht: updates.wholesale_price_ht ?? existingItem?.wholesale_price_ht ?? 0,
        wholesale_price_ttc: updates.wholesale_price_ttc ?? existingItem?.wholesale_price_ttc ?? 0,
        cost: updates.cost ?? existingItem?.cost ?? 0,
        category: existingItem?.category,
        updated_at: now,
        synced: false,
      };

      await LocalDatabase.saveInventoryItem(localItem);

      if (!navigator.onLine) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'inventory_update',
          data: { id, ...updates, updated_at: now },
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: 'Item Updated (Offline)',
          description: 'Will sync when back online.',
        });

        return {
          data: mapLocalInventoryToItem(localItem),
        };
      }

      // Map updates to DB format
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.sku !== undefined) dbUpdates.sku = updates.sku;
      if (updates.price !== undefined) dbUpdates.unit_price = updates.price;
      if (updates.wholesale_price !== undefined) dbUpdates.wholesale_price = updates.wholesale_price;
      if (updates.wholesale_price_ht !== undefined) dbUpdates.wholesale_price_ht = updates.wholesale_price_ht;
      if (updates.wholesale_price_ttc !== undefined) dbUpdates.wholesale_price_ttc = updates.wholesale_price_ttc;
      if (updates.cost !== undefined) dbUpdates.cost_price = updates.cost;
      if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
      if (updates.low_stock_threshold !== undefined) dbUpdates.min_quantity = updates.low_stock_threshold;
      if (updates.store_id !== undefined) dbUpdates.store_id = updates.store_id;
      if (updates.image_url !== undefined) dbUpdates.image_url = updates.image_url;

      // Try to sync immediately
      const { data: remoteProduct, error } = await supabase
        .from('products')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'inventory_update',
          data: { id, ...updates, updated_at: now },
          timestamp: Date.now(),
          retries: 0,
        });

        return {
          data: mapLocalInventoryToItem(localItem),
        };
      }

      await LocalDatabase.markInventoryItemSynced(id);
      return { data: remoteProduct ? mapDbToInventoryItem(remoteProduct) : undefined };
    } catch (error) {
      console.error('Update item error:', error);
      return { error };
    }
  }

  /**
   * Delete an inventory item (works offline)
   */
  static async deleteItem(id: string): Promise<{ error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/products/${id}`, {
            method: 'DELETE',
            headers: { ...headers },
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            return { error: payload };
          }
          await LocalDatabase.init();
          await LocalDatabase.deleteInventoryItem(id);
          return {};
        }
      }

      await LocalDatabase.init();

      // Delete locally immediately
      await LocalDatabase.deleteInventoryItem(id);

      if (!navigator.onLine) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'inventory_delete',
          data: { id },
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: 'Item Deleted (Offline)',
          description: 'Will sync when back online.',
        });

        return {};
      }

      // Try to sync immediately
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'inventory_delete',
          data: { id },
          timestamp: Date.now(),
          retries: 0,
        });
      }

      return { error };
    } catch (error) {
      console.error('Delete item error:', error);
      return { error };
    }
  }

  /**
   * Get product families (offline robust)
   */
  static async getProductFamilies(storeId?: string): Promise<{ data?: LocalProductFamily[]; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const params = new URLSearchParams();
          if (storeId) params.set('store_id', storeId);
          const response = await fetch(
            `${dataClient.localBridgeBaseUrl}/rest/v1/product_families?${params.toString()}`,
            { headers }
          );
          if (response.ok) {
            const payload = await response.json().catch(() => []);
            // Cache remote results
            await LocalDatabase.init();
            if (payload) {
              for (const fam of payload) {
                await LocalDatabase.saveProductFamily({
                  id: fam.id,
                  store_id: fam.store_id,
                  name: fam.name,
                  description: fam.description,
                  parent_id: fam.parent_id,
                  created_at: fam.created_at,
                  updated_at: fam.updated_at,
                  synced: true,
                } as LocalProductFamily);
              }
              return { data: payload as LocalProductFamily[] };
            }
          }
        }
      }

      await LocalDatabase.init();
      const localFamilies = await LocalDatabase.getProductFamilies(storeId);

      if (!navigator.onLine) {
        return { data: localFamilies };
      }

      let query = supabase.from('product_families').select('*');
      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data: remoteFamilies, error } = await query.order('name');

      if (error) {
        console.error('Failed to fetch remote families:', error);
        return { data: localFamilies };
      }

      if (remoteFamilies) {
        for (const fam of remoteFamilies) {
          await LocalDatabase.saveProductFamily({
            id: fam.id,
            store_id: fam.store_id,
            name: fam.name,
            description: fam.description,
            parent_id: fam.parent_id,
            created_at: fam.created_at,
            updated_at: fam.updated_at,
            synced: true,
          } as LocalProductFamily);
        }
        return { data: remoteFamilies as LocalProductFamily[] };
      }

      return { data: localFamilies };
    } catch (error) {
      console.error('Get families error:', error);
      return { error };
    }
  }

  /**
   * Get low stock items
   */
  static async getLowStockItems(threshold = 10): Promise<{ data?: InventoryItem[]; error?: any }> {
    const result = await this.getInventory();
    if (result.error) return result;

    const lowStockItems = (result.data || []).filter(
      item => item.quantity <= (item.low_stock_threshold || threshold)
    );

    return { data: lowStockItems };
  }
}
