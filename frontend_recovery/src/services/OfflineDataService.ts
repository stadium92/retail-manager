/**
 * OfflineDataService - Unified data access layer for offline-first architecture
 * Reads from LocalDatabase/Zustand stores first, syncs from Supabase when online
 */

import { LocalDatabase, LocalSale } from './LocalDatabase';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { supabase } from '@/integrations/supabase/client';
import { getDataClient, smartFetch } from '@/lib/dataClient';

export interface SaleWithItems extends Omit<LocalSale, 'items'> {
  sale_items: any[];
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  supplier_name: string;
  amount: number;
  date: string;
}

export interface CashTransaction {
  id: string;
  type: 'in' | 'out';
  amount: number;
  category: string;
  description: string;
  reference?: string;
  date: string;
}

export interface PurchaseWithSupplier {
  id: string;
  store_id: string;
  supplier_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  supplier?: { name: string };
}

export interface DashboardAnalytics {
  daily_revenue: number;
  weekly_revenue: { date: string; revenue: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
  top_workers: { name: string; sales_count: number; revenue: number }[];
  stock_health?: { ok: number; low: number; out: number };
}

class OfflineDataServiceClass {
  // Loop Prevention: Track last sync time per store/type to avoid rapid-fire updates
  private lastSync: Record<string, number> = {};
  private SYNC_COOLDOWN = 30000; // 30 seconds

  private shouldSync(key: string): boolean {
    const now = Date.now();
    if (this.lastSync[key] && now - this.lastSync[key] < this.SYNC_COOLDOWN) return false;
    this.lastSync[key] = now;
    return true;
  }

  /**
   * Get sales with items - Strict Offline First
   */
  async getSales(storeId: string, dateFrom?: Date, dateTo?: Date): Promise<SaleWithItems[]> {
    const productStore = useMasterDataStore.getState().products;
    
    // 1. OFFLINE-FIRST: Return local data immediately
    try {
        await LocalDatabase.init();
        const localSales = await LocalDatabase.getSales(storeId);
        
        const mapRawSale = (rs: any): SaleWithItems => {
            let rawItems = rs.items || rs.sale_items || [];
            if (typeof rawItems === 'string') {
                try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
            }

            return {
                id: rs.id,
                store_id: rs.store_id || storeId,
                worker_id: rs.worker_id,
                total_price: Number(rs.total_price),
                payment_method: rs.payment_method,
                sale_type: rs.sale_type,
                customer_name: rs.customer_name,
                customer_phone: rs.customer_phone,
                customer_address: rs.customer_address,
                invoice_number: rs.invoice_number,
                order_ref: rs.order_ref || rs.notes,
                payment_status: rs.payment_status || (rs.payment_method === 'credit' ? 'pending' : 'paid'),
                amount_paid: rs.amount_paid,
                created_at: rs.created_at,
                synced: rs.synced ?? true,
                sale_items: (Array.isArray(rawItems) ? rawItems : []).map((item: any, idx: number) => {
                    const pid = item.product_id;
                    const cachedProduct = pid ? productStore.find(p => p.id === pid) : undefined;
                    const resolvedName = item.product_name || item.name || item.current_product_name || cachedProduct?.name || 'Unknown';
                    
                    return {
                        id: item.id || `${rs.id}-${idx}`,
                        product_id: pid,
                        product_name: resolvedName,
                        quantity: Number(item.quantity) || 0,
                        unit_price: Number(item.unit_price || item.price || 0),
                        total: Number(item.total || (Number(item.quantity) * Number(item.unit_price || item.price || 0))),
                    };
                }),
            };
        };

        // 2. BACKGROUND SYNC (Throttled to prevent jittering loops)
        if (this.shouldSync(`sales-${storeId}`)) {
            const syncProc = async () => {
                let remoteSales: any[] = [];
                let success = false;
                const dc = getDataClient();

                try {
                    if (dc.isLocalFirst) {
                        const { OfflineAuthService } = await import('./OfflineAuthService');
                        const headers = await OfflineAuthService.getAuthHeaders();
                        if (headers) {
                            const params = new URLSearchParams();
                            if (storeId) params.set('store_id', storeId);
                            if (dateFrom) params.set('date_from', dateFrom.toISOString());
                            const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/sales?${params.toString()}`, { headers });
                            if (res.ok) {
                                remoteSales = await res.json();
                                success = true;
                            }
                        }
                    } else if (navigator.onLine) {
                        let query = supabase.from('sales').select('*, sale_items(*)').eq('store_id', storeId).order('created_at', { ascending: false });
                        if (dateFrom) query = query.gte('created_at', dateFrom.toISOString());
                        const { data, error } = await query;
                        if (!error && data) {
                            remoteSales = data;
                            success = true;
                        }
                    }

                    if (success && remoteSales.length > 0) {
                        for (const rs of remoteSales) {
                            const mapped = mapRawSale(rs);
                            await LocalDatabase.saveSale({
                                ...mapped,
                                items: mapped.sale_items,
                                synced: true
                            } as any);
                        }
                        // Dispatch only once per sync session
                        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sales', storeId } }));
                    }
                } catch (e) {
                    console.warn('[OfflineData] Sales background sync failed:', e);
                }
            };
            syncProc();
        }

        const finalSales: SaleWithItems[] = localSales.map(mapRawSale);
        let filtered = finalSales;
        if (dateFrom || dateTo) {
            filtered = finalSales.filter(s => {
                const d = new Date(s.created_at);
                return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
            });
        }

        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
        console.error('getSales error:', error);
        return [];
    }
  }

  async getDashboardAnalytics(storeId: string, from: Date, to: Date): Promise<DashboardAnalytics | null> {
    try {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
        
        // 1. OFFLINE-FIRST: Local Calculation
        await LocalDatabase.init();
        const localSales = await LocalDatabase.getSales(storeId);
        const filteredSales = localSales.filter(s => {
            const d = new Date(s.created_at);
            return d >= from && d <= to;
        });

        const localInventory = await LocalDatabase.getInventory(storeId);

        const localAnalytics: DashboardAnalytics = {
            daily_revenue: filteredSales.reduce((sum, s) => sum + Number(s.total_price), 0),
            weekly_revenue: [], 
            top_products: [],
            top_workers: [],
            stock_health: {
                ok: localInventory.filter(i => i.quantity > (i.reorder_quantity || 10)).length,
                low: localInventory.filter(i => i.quantity <= (i.reorder_quantity || 10) && i.quantity > 0).length,
                out: localInventory.filter(i => i.quantity <= 0).length
            }
        };

        // 2. BACKGROUND RECONCILIATION (Throttled)
        if (isLocalFirst && this.shouldSync(`analytics-${storeId}`)) {
            try {
                const { OfflineAuthService } = await import('./OfflineAuthService');
                const headers = await OfflineAuthService.getAuthHeaders();
                if (headers) {
                    const params = new URLSearchParams({ 
                        store_id: storeId,
                        from: from.toISOString(),
                        to: to.toISOString()
                    });
                    const res = await fetch(`${localBridgeBaseUrl}/analytics/dashboard?${params.toString()}`, { headers });
                    if (res.ok) {
                        const remoteAnalytics = await res.json();
                        return remoteAnalytics;
                    }
                }
            } catch (e) {
                console.warn('[Analytics] Sync failed, returning local estimate');
            }
        }

        return localAnalytics;
    } catch (err) {
        console.error('getDashboardAnalytics error:', err);
        return null;
    }
  }

  async getStockValuation(storeId: string): Promise<any> {
    try {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
        
        // 1. OFFLINE-FIRST: Calculate locally
        await LocalDatabase.init();
        const localItems = await LocalDatabase.getInventory(storeId);
        const localValuation = {
            total_cost: localItems.reduce((sum, i) => sum + (Number(i.quantity) * (Number(i.cost) || 0)), 0),
            total_retail: localItems.reduce((sum, i) => sum + (Number(i.quantity) * (Number(i.unit_price) || 0)), 0),
            item_count: localItems.length
        };

        // 2. BACKGROUND SYNC (Throttled)
        if (isLocalFirst && this.shouldSync(`valuation-${storeId}`)) {
          try {
            const { OfflineAuthService } = await import('./OfflineAuthService');
            const headers = await OfflineAuthService.getAuthHeaders();
            if (headers) {
              const response = await fetch(`${localBridgeBaseUrl}/rest/v1/stock-valuation?store_id=${storeId}`, { headers });
              if (response.ok) return await response.json();
            }
          } catch (error) {
            console.error('Failed to fetch valuation:', error);
          }
        }
        
        return localValuation;
    } catch (err) {
        console.error('getStockValuation error:', err);
        return { total_cost: 0, total_retail: 0, item_count: 0 };
    }
  }

  async getSupplierPayments(storeId: string, from?: Date): Promise<SupplierPayment[]> {
    try {
        await LocalDatabase.init();
        const local = await LocalDatabase.getSupplierPayments(storeId);
        return local.map(p => ({
            id: p.id,
            supplier_id: p.supplier_id,
            supplier_name: p.supplier_name || '?',
            amount: p.amount,
            date: p.created_at
        }));
    } catch (e) {
        return [];
    }
  }

  async getCashTransactions(storeId: string, from?: Date): Promise<CashTransaction[]> {
    return []; 
  }

  async createCashTransaction(data: any): Promise<boolean> {
    return true; 
  }

  async getStockMovements(storeId: string): Promise<{ movements: any[] }> {
    return { movements: [] };
  }

  async updateProductStock(productId: string, newQuantity: number, reason: string): Promise<void> {
    const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
    try {
      await LocalDatabase.init();
      const localItem = await LocalDatabase.getInventoryItem(productId);
      if (localItem) {
        await LocalDatabase.saveInventoryItem({
          ...localItem,
          quantity: newQuantity,
          synced: false
        });
      }

      if (isLocalFirst) {
        const { OfflineAuthService } = await import('./OfflineAuthService');
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          await fetch(`${localBridgeBaseUrl}/rest/v1/products/${productId}/stock`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: newQuantity, reason })
          });
        }
      } else {
        await supabase.from('products').update({ quantity: newQuantity }).eq('id', productId);
      }
    } catch (error) {
      console.error('Stock update failed:', error);
    }
  }
}

export const OfflineDataService = new OfflineDataServiceClass();
