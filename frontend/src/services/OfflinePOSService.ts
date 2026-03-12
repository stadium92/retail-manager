/**
 * OfflinePOSService - Handles POS operations offline-first
 * All operations work locally and sync when online
 */

import { LocalDatabase, LocalSale, LocalInventory } from './LocalDatabase';
import i18n from '@/i18n/config';
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
          title: i18n.t('sync.saleRecordedOffline'),
          description: `${data.items.length} items - Will sync when online`,
        });

        return { success: true, saleId };
      }

      // Cloud sync disabled - queue for later sync
      await LocalDatabase.addToSyncQueue({
        id: crypto.randomUUID(),
        type: 'sale',
        data: localSale,
        timestamp: Date.now(),
        retries: 0,
      });

      toast({
        title: i18n.t('sync.saleRecordedLocally'),
        description: `${data.items.length} items - Will sync when online`,
      });

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

      // Cloud sync disabled - queue for later sync
      await LocalDatabase.addToSyncQueue({
        id: crypto.randomUUID(),
        type: 'inventory_update',
        data: item,
        timestamp: Date.now(),
        retries: 0,
      });

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
