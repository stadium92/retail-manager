/**
 * OfflinePOSService - Handles POS operations offline-first
 * All operations work locally and sync when online
 */

import { LocalDatabase, LocalSale, LocalInventory } from './LocalDatabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SaleType } from '@/types';

export interface POSSaleItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface POSSaleData {
  store_id?: string;
  worker_id?: string;
  items: POSSaleItem[];
  total_price: number;
  payment_method: 'cash' | 'card' | 'mobile' | 'credit';
  sale_type?: SaleType;
  customer_name?: string;
  notes?: string;
}

export class OfflinePOSService {
  /**
   * Record a sale - works offline and online
   */
  static async recordSale(data: POSSaleData): Promise<{ success: boolean; saleId: string; error?: string }> {
    const saleId = crypto.randomUUID();
    const now = new Date().toISOString();
    const isOnline = navigator.onLine;

    try {
      await LocalDatabase.init();

      // Always save locally first
      const localSale: LocalSale = {
        id: saleId,
        store_id: data.store_id,
        worker_id: data.worker_id,
        items: data.items,
        total_price: data.total_price,
        payment_method: data.payment_method,
        sale_type: data.sale_type || 'detail',
        customer_name: data.customer_name,
        created_at: now,
        synced: false,
      };

      await LocalDatabase.saveSale(localSale);

      // Update local inventory (products)
      for (const item of data.items) {
        if (item.product_id) {
          const inventory = await this.getLocalInventoryItem(item.product_id);
          if (inventory) {
            inventory.quantity = Math.max(0, inventory.quantity - item.quantity);
            inventory.updated_at = now;
            inventory.synced = false;
            await LocalDatabase.saveInventoryItem(inventory);
          }
        }
      }

      if (!isOnline) {
        // Queue for later sync
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'sale',
          data: localSale,
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: 'Sale Recorded (Offline)',
          description: `${data.items.length} items - Will sync when online`,
        });

        return { success: true, saleId };
      }

      // Try to sync immediately if online
      // Cast as any - sales schema may require item_id which we don't have in multi-item flow
      const { error: saleError } = await (supabase as any).from('sales').insert([{
        id: saleId,
        store_id: data.store_id,
        worker_id: data.worker_id,
        total_price: data.total_price,
        customer_name: data.customer_name,
        notes: data.notes,
        sale_type: data.sale_type || 'detail',
        payment_method: data.payment_method,
        payment_status: 'paid',
        item_id: data.items[0]?.product_id || null, // Legacy field for backwards compatibility
        quantity: data.items.reduce((sum, i) => sum + i.quantity, 0),
        unit_price: data.items[0]?.unit_price || 0,
      }]);

      if (saleError) {
        // Queue for later sync
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'sale',
          data: localSale,
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: 'Sale Recorded Locally',
          description: 'Server sync failed, will retry later',
          variant: 'destructive',
        });
      } else {
        // Insert sale items
        const saleItems = data.items.map(item => ({
          sale_id: saleId,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        }));

        await supabase.from('sale_items').insert(saleItems);

        // Mark as synced
        await LocalDatabase.markSaleSynced(saleId);
        toast({
          title: 'Sale Recorded',
          description: `${data.items.length} items - Synced`,
        });
      }

      return { success: true, saleId };
    } catch (error) {
      console.error('Record sale error:', error);
      return { success: false, saleId: '', error: 'Failed to record sale' };
    }
  }

  /**
   * Get sales (from local database, merges with remote if online)
   */
  static async getSales(storeId?: string, dateRange?: { start: Date; end: Date }): Promise<LocalSale[]> {
    try {
      await LocalDatabase.init();
      let localSales = await LocalDatabase.getSales(storeId);

      // Filter by date range if provided
      if (dateRange) {
        localSales = localSales.filter(sale => {
          const saleDate = new Date(sale.created_at);
          return saleDate >= dateRange.start && saleDate <= dateRange.end;
        });
      }

      // If online, also fetch from server and merge
      if (navigator.onLine) {
        try {
          let query = supabase.from('sales').select('*, sale_items(*)');
          
          if (storeId) {
            query = query.eq('store_id', storeId);
          }
          
          if (dateRange) {
            query = query
              .gte('created_at', dateRange.start.toISOString())
              .lte('created_at', dateRange.end.toISOString());
          }

          const { data: remoteSales } = await query;

          if (remoteSales) {
            // Merge: prioritize local unsynced, add remote synced
            const localIds = new Set(localSales.filter(s => !s.synced).map(s => s.id));
            const mergedSales = [...localSales.filter(s => !s.synced)];
            
            for (const remoteSale of remoteSales) {
              if (!localIds.has(remoteSale.id)) {
                // Get items from sale_items relation
                const items = (remoteSale.sale_items as any[]) || [];
                mergedSales.push({
                  id: remoteSale.id,
                  store_id: remoteSale.store_id || undefined,
                  worker_id: remoteSale.worker_id || undefined,
                  items: items.map((item: any) => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total: item.total,
                  })),
                  total_price: remoteSale.total_price || 0,
                  payment_method: remoteSale.payment_method || 'cash',
                  sale_type: (remoteSale.sale_type as SaleType) || 'detail',
                  customer_name: remoteSale.customer_name || undefined,
                  created_at: remoteSale.created_at,
                  synced: true,
                });
              }
            }

            return mergedSales.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          }
        } catch (error) {
          console.log('Failed to fetch remote sales, using local only');
        }
      }

      return localSales.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('Get sales error:', error);
      return [];
    }
  }

  /**
   * Get today's sales summary
   */
  static async getTodaySummary(storeId?: string, workerId?: string): Promise<{
    totalSales: number;
    totalRevenue: number;
    itemsSold: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const sales = await this.getSales(storeId, { start: today, end: tomorrow });
      
      let filtered = sales;
      if (workerId) {
        filtered = sales.filter(s => s.worker_id === workerId);
      }

      return {
        totalSales: filtered.length,
        totalRevenue: filtered.reduce((sum, s) => sum + s.total_price, 0),
        itemsSold: filtered.reduce((sum, s) => sum + s.items.reduce((is, i) => is + (i.quantity || 0), 0), 0),
      };
    } catch (error) {
      console.error('Get today summary error:', error);
      return { totalSales: 0, totalRevenue: 0, itemsSold: 0 };
    }
  }

  /**
   * Get inventory/products (local + remote merge)
   */
  static async getInventory(storeId?: string): Promise<LocalInventory[]> {
    try {
      await LocalDatabase.init();
      const localInventory = await LocalDatabase.getInventory(storeId);

      if (navigator.onLine) {
        try {
          let query = supabase.from('products').select('*');
          if (storeId) {
            query = query.eq('store_id', storeId);
          }

          const { data: remoteProducts } = await query;

          if (remoteProducts) {
            // Merge and cache remotely
            for (const product of remoteProducts) {
              const existingLocal = localInventory.find(l => l.id === product.id);
              if (!existingLocal || existingLocal.synced) {
                const localItem: LocalInventory = {
                  id: product.id,
                  store_id: product.store_id,
                  product_name: product.name,
                  sku: product.sku || undefined,
                  quantity: product.quantity || 0,
                  unit_price: Number(product.unit_price) || 0,
                  category: product.category || undefined,
                  updated_at: product.updated_at || new Date().toISOString(),
                  synced: true,
                };
                await LocalDatabase.saveInventoryItem(localItem);
              }
            }

            return LocalDatabase.getInventory(storeId);
          }
        } catch (error) {
          console.log('Failed to fetch remote inventory, using local only');
        }
      }

      return localInventory;
    } catch (error) {
      console.error('Get inventory error:', error);
      return [];
    }
  }

  /**
   * Update inventory item
   */
  static async updateInventory(item: LocalInventory): Promise<{ success: boolean }> {
    try {
      await LocalDatabase.init();
      item.updated_at = new Date().toISOString();
      item.synced = false;
      await LocalDatabase.saveInventoryItem(item);

      if (!navigator.onLine) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'inventory_update',
          data: item,
          timestamp: Date.now(),
          retries: 0,
        });
        return { success: true };
      }

      // Try immediate sync to products table
      const { error } = await supabase.from('products').upsert({
        id: item.id,
        store_id: item.store_id,
        name: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
      });

      if (!error) {
        item.synced = true;
        await LocalDatabase.saveInventoryItem(item);
      } else {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'inventory_update',
          data: item,
          timestamp: Date.now(),
          retries: 0,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Update inventory error:', error);
      return { success: false };
    }
  }

  private static async getLocalInventoryItem(id: string): Promise<LocalInventory | null> {
    const inventory = await LocalDatabase.getInventory();
    return inventory.find(i => i.id === id) || null;
  }
}
