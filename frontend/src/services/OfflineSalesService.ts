import { LocalDatabase } from "./LocalDatabase";
import { getDataClient } from "@/lib/dataClient";
import { OfflineAuthService } from "./OfflineAuthService";

export const OfflineSalesService = {
    /**
     * Create a sale with items atomically on the local bridge
     */
    async createSaleWithItems(sale: any, items: any[]): Promise<{ data?: any; error?: any }> {
        const { isLocalFirst } = getDataClient();
        
        if (isLocalFirst) {
            try {
                // Map cart items to the shape the backend expects (product_id, product_name, unit_price)
                const mappedItems = items.map((item: any) => ({
                    id: item.id || crypto.randomUUID(),
                    // Try all possible variations of product ID and Name
                    product_id: item.product_id || item.productId || item.product?.id || null,
                    product_name: item.product_name || item.productName || item.designation || item.product?.name || 'Unknown',
                    quantity: Number(item.quantity) || 0,
                    unit_price: Number(item.unit_price ?? item.unitPrice ?? 0),
                    discount: Number(item.discount ?? item.discountPercent ?? 0),
                    total: Number(item.total ?? item.lineTotal ?? 0),
                }));

                // Standard backend POST /rest/v1/sales expects items in the same object
                const payload = { ...sale, items: mappedItems };

                console.log('[OfflineSales] Sending sale to bridge:', payload);

                const result = await OfflineAuthService.localBridgeRequest<any>('/rest/v1/sales', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

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
      const { isLocalFirst } = getDataClient();
      if (isLocalFirst) {
        try {
            return await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/sales?store_id=${storeId}`, { method: 'GET' });
        } catch (e) {
            console.error('[OfflineSales] Fetch failed:', e);
            throw e;
        }
      }
      return await LocalDatabase.getSales(storeId);
    },

    async getSaleMetrics(storeId: string): Promise<{ todaySales: number; weekSales: number; monthSales: number; error?: any }> {
        try {
            const { isLocalFirst } = getDataClient();
            let sales: any[] = [];

            if (isLocalFirst) {
                sales = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/sales?store_id=${storeId}`, { method: 'GET' });
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
