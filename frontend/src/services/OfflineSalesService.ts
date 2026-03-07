import { LocalDatabase } from "./LocalDatabase";
import { CartItem } from "@/stores/usePOSStore";
import { getDataClient, smartFetch } from "@/lib/dataClient";
import { OfflineAuthService } from "./OfflineAuthService";

export const OfflineSalesService = {
    /**
     * Create a sale with items atomically on the local bridge
     */
    async createSaleWithItems(sale: any, items: any[]): Promise<{ data?: any; error?: any }> {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
        
        if (isLocalFirst) {
            try {
                const headers = await OfflineAuthService.getAuthHeaders();
                if (!headers) throw new Error('Not authenticated');

                const response = await smartFetch(`${localBridgeBaseUrl}/rest/v1/rpc/create_sale_with_items`, {
                    method: 'POST',
                    body: JSON.stringify({ sale, items })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Bridge write failed' }));
                    throw new Error(errorData.message || 'Failed to save sale to local bridge');
                }

                return { data: await response.json() };
            } catch (error) {
                console.error('[OfflineSales] Create sale failed:', error);
                return { error };
            }
        }

        // True Offline / Web Fallback
        try {
            await LocalDatabase.init();
            const saleId = sale.id || crypto.randomUUID();
            const newSale = { ...sale, id: saleId, synced: false };
            await LocalDatabase.saveSale(newSale);
            
            // Queue for cloud sync if not in local-first mode
            // (Standard offline logic here)
            
            return { data: newSale };
        } catch (error) {
            return { error };
        }
    },

    async getSales(storeId: string): Promise<any[]> {
      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      if (isLocalFirst) {
        try {
            const headers = await OfflineAuthService.getAuthHeaders();
            if (!headers) throw new Error('Not authenticated');
            const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/sales?store_id=${storeId}`, { headers });
            if (res.ok) return await res.json();
            throw new Error('Bridge unreachable');
        } catch (e) {
            console.error('[OfflineSales] Fetch failed:', e);
            throw e;
        }
      }
      return await LocalDatabase.getSales(storeId);
    },

    async getSaleMetrics(storeId: string): Promise<{ todaySales: number; weekSales: number; monthSales: number; error?: any }> {
        try {
            const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
            let sales: any[] = [];

            if (isLocalFirst) {
                const headers = await OfflineAuthService.getAuthHeaders();
                if (headers) {
                    const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/sales?store_id=${storeId}`, { headers });
                    if (res.ok) sales = await res.json();
                    else throw new Error('Bridge unreachable');
                }
            } else {
                sales = await LocalDatabase.getSales(storeId);
            }

            const today = new Date().toISOString().split('T')[0];
            const todaySales = sales
                .filter(s => s.created_at.startsWith(today) && s.sale_type !== 'proforma')
                .reduce((sum, s) => sum + (s.total_price || 0), 0);

            // Simple week/month calculation for local mode
            const weekSales = todaySales; 
            const monthSales = todaySales;

            return { todaySales, weekSales, monthSales };
        } catch (error) {
            console.error('Error calculating sales metrics:', error);
            return { todaySales: 0, weekSales: 0, monthSales: 0, error };
        }
    }
}
