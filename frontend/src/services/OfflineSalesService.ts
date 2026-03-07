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
                const { OfflineAuthService } = await import('./OfflineAuthService');
                const headers = await OfflineAuthService.getAuthHeaders();
                if (!headers) throw new Error('Not authenticated');

                // Standard backend POST /rest/v1/sales expects items in the same object
                const payload = { ...sale, items };

                console.log('[OfflineSales] Sending sale to bridge:', payload);

                const response = await smartFetch(`${localBridgeBaseUrl}/rest/v1/sales`, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Bridge write failed' }));
                    console.error('[OfflineSales] Bridge error:', errorData);
                    throw new Error(errorData.message || 'Failed to save sale to local bridge');
                }

                const result = await response.json();
                console.log('[OfflineSales] Sale saved successfully:', result);
                return { data: result };
            } catch (error) {
                console.error('[OfflineSales] Create sale failed:', error);
                return { error };
            }
        }

        // Web Fallback (True Offline)
        try {
            await LocalDatabase.init();
            const saleId = sale.id || crypto.randomUUID();
            const newSale = { ...sale, id: saleId, items, synced: false };
            await LocalDatabase.saveSale(newSale);
            return { data: newSale };
        } catch (error) {
            return { error };
        }
    },

    async getSales(storeId: string): Promise<any[]> {
      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      if (isLocalFirst) {
        try {
            const { OfflineAuthService } = await import('./OfflineAuthService');
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
                const { OfflineAuthService } = await import('./OfflineAuthService');
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
                .filter(s => s.created_at && s.created_at.startsWith(today) && s.sale_type !== 'proforma')
                .reduce((sum, s) => sum + (s.total_price || 0), 0);

            // Simple calculation for local mode
            const weekSales = todaySales; 
            const monthSales = todaySales;

            return { todaySales, weekSales, monthSales };
        } catch (error) {
            console.error('Error calculating sales metrics:', error);
            return { todaySales: 0, weekSales: 0, monthSales: 0, error };
        }
    }
}
