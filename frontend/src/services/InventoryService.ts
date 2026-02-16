import { supabase } from '@/integrations/supabase/client';
import { InventoryItem } from '@/types';
import { inventorySchema, inventoryUpdateSchema } from '@/schemas/validation';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';

// Helper to map DB product row to InventoryItem (legacy compatibility)
const mapDbToInventoryItem = (row: any): InventoryItem => ({
  id: row.id,
  name: row.name,
  description: row.description,
  sku: row.sku,
  price: Number(row.unit_price) || 0,
  cost: Number(row.cost_price) || 0,
  quantity: row.quantity,
  low_stock_threshold: row.min_quantity,
  category_id: row.category,
  store_id: row.store_id,
  image_url: row.image_url,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// Helper to map InventoryItem to DB products for insert/update
const mapInventoryToDb = (item: Partial<InventoryItem>): Record<string, any> => ({
  name: item.name,
  description: item.description,
  sku: item.sku,
  unit_price: item.price,
  cost_price: item.cost,
  quantity: item.quantity,
  min_quantity: item.low_stock_threshold,
  category: item.category_id,
  store_id: item.store_id,
  image_url: item.image_url,
});

export class InventoryService {
  static async getInventory(storeId?: string): Promise<{ data?: InventoryItem[]; error?: any }> {
    try {
      const dataClient = getDataClient();
      const localHeaders = dataClient.isLocalFirst ? await OfflineAuthService.getAuthHeaders() : null;
      if (dataClient.isLocalFirst) {
        if (!localHeaders) {
          return { error: { message: 'Local session required.' } };
        }
        const params = new URLSearchParams();
        if (storeId) params.set('store_id', storeId);
        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, {
          headers: { ...localHeaders },
        });
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          return { error: errorPayload };
        }
        const data = await response.json();
        const items = (data || []).map(mapDbToInventoryItem);
        return { data: items };
      }

      let query = supabase
        .from('products')
        .select('*')
        .order('name');

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

      if (error) return { error };
      
      const items = (data || []).map(mapDbToInventoryItem);
      return { data: items, error };
    } catch (error) {
      return { error };
    }
  }

  static async getItem(id: string): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      const dataClient = getDataClient();
      const localHeaders = dataClient.isLocalFirst ? await OfflineAuthService.getAuthHeaders() : null;
      if (dataClient.isLocalFirst) {
        if (!localHeaders) {
          return { error: { message: 'Local session required.' } };
        }
        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/products?${new URLSearchParams({ product_id: id }).toString()}`, {
          headers: { ...localHeaders },
        });
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          return { error: errorPayload };
        }
        const data = await response.json();
        const item = Array.isArray(data) ? data[0] : data;
        return { data: item ? mapDbToInventoryItem(item) : undefined };
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return { error };
      
      return { data: data ? mapDbToInventoryItem(data) : undefined, error };
    } catch (error) {
      return { error };
    }
  }

  static async createItem(item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      // Validate input
      const validationResult = inventorySchema.safeParse(item);
      if (!validationResult.success) {
        return { error: { message: validationResult.error.errors[0].message } };
      }

      const validData = validationResult.data;
      const dataClient = getDataClient();
      const localHeaders = dataClient.isLocalFirst ? await OfflineAuthService.getAuthHeaders() : null;

      if (dataClient.isLocalFirst) {
        if (!localHeaders) {
          return { error: { message: 'Local session required.' } };
        }
        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...localHeaders },
          body: JSON.stringify(mapInventoryToDb(validData)),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return { data: payload ? mapDbToInventoryItem(payload) : undefined };
      }

      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: validData.name,
          store_id: validData.store_id,
          description: validData.description,
          sku: validData.sku,
          unit_price: validData.price,
          cost_price: validData.cost,
          quantity: validData.quantity,
          min_quantity: validData.low_stock_threshold,
          category: validData.category_id,
          image_url: validData.image_url,
        }])
        .select()
        .single();

      if (error) return { error };
      return { data: data ? mapDbToInventoryItem(data) : undefined, error };
    } catch (error) {
      return { error };
    }
  }

  static async updateItem(id: string, updates: Partial<InventoryItem>): Promise<{ data?: InventoryItem; error?: any }> {
    try {
      // Validate input
      const validationResult = inventoryUpdateSchema.safeParse(updates);
      if (!validationResult.success) {
        return { error: { message: validationResult.error.errors[0].message } };
      }

      const dbData = mapInventoryToDb(validationResult.data);
      const dataClient = getDataClient();
      const localHeaders = dataClient.isLocalFirst ? await OfflineAuthService.getAuthHeaders() : null;

      if (dataClient.isLocalFirst) {
        if (!localHeaders) {
          return { error: { message: 'Local session required.' } };
        }
        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...localHeaders },
          body: JSON.stringify(dbData),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return { data: payload ? mapDbToInventoryItem(payload) : undefined };
      }

      const { data, error } = await supabase
        .from('products')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();

      if (error) return { error };
      
      return { data: data ? mapDbToInventoryItem(data) : undefined, error };
    } catch (error) {
      return { error };
    }
  }

  static async deleteItem(id: string): Promise<{ error?: any }> {
    try {
      const dataClient = getDataClient();
      const localHeaders = dataClient.isLocalFirst ? await OfflineAuthService.getAuthHeaders() : null;
      if (dataClient.isLocalFirst) {
        if (!localHeaders) {
          return { error: { message: 'Local session required.' } };
        }
        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/products/${id}`, {
          method: 'DELETE',
          headers: { ...localHeaders },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          return { error: payload };
        }
        return {};
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      return { error };
    }
  }

  static async getLowStockItems(storeId?: string): Promise<{ data?: InventoryItem[]; error?: any }> {
    try {
      const dataClient = getDataClient();
      const localHeaders = dataClient.isLocalFirst ? await OfflineAuthService.getAuthHeaders() : null;
      if (dataClient.isLocalFirst) {
        if (!localHeaders) {
          return { error: { message: 'Local session required.' } };
        }
        const params = new URLSearchParams();
        if (storeId) params.set('store_id', storeId);
        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, {
          headers: { ...localHeaders },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          return { error: payload };
        }
        const data = await response.json();
        const items = (data || []).map(mapDbToInventoryItem);
        const lowStockItems = items.filter(item => item.quantity <= (item.low_stock_threshold || 10));
        return { data: lowStockItems };
      }

      let query = supabase
        .from('products')
        .select('*')
        .order('quantity');

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

      if (error) return { error };

      // Filter low stock items manually
      const items = (data || []).map(mapDbToInventoryItem);
      const lowStockItems = items.filter(item => item.quantity <= (item.low_stock_threshold || 10));

      return { data: lowStockItems, error };
    } catch (error) {
      return { error };
    }
  }
}
