import { LocalDatabase } from "./LocalDatabase";
import { getDataClient } from "@/lib/dataClient";
import { OfflineAuthService } from "./OfflineAuthService";

interface DailyRevenue {
    today: number;
    week: number;
    month: number;
    count: number;
}

interface WorkerStats {
    id: string;
    name: string;
    sales_count: number;
    revenue: number;
}

interface ProductPerformance {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
}

export interface SaleWithItems {
    id: string;
    store_id: string;
    worker_id?: string;
    client_id?: string;
    customer_name?: string;
    customer_phone?: string;
    sale_type: string;
    total_price: number;
    discount: number;
    tax: number;
    payment_method: string;
    payment_status: string;
    notes?: string;
    invoice_number?: string;
    created_at: string;
    updated_at: string;
    items?: any[];
    sale_items?: any[];
}

class OfflineDataServiceClass {
    // Loop Prevention: Track last sync time per store/type to avoid rapid-fire updates
    private lastSync: Record<string, number> = {};
    private SYNC_COOLDOWN = 30000; // 30 seconds

    private shouldSync(key: string): boolean {
        // Always return false to stop background background cycles
        return false;
    }

    async getDailyRevenue(storeId: string): Promise<DailyRevenue> {
        try {
            const { isLocalFirst } = getDataClient();
            let sales: any[] = [];

            if (isLocalFirst) {
                sales = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/sales?store_id=${storeId}`, { method: 'GET' });
            } else {
                sales = await LocalDatabase.getSales(storeId);
            }

            const today = new Date().toISOString().split('T')[0];
            const todaySales = sales.filter(s => s.created_at && s.created_at.startsWith(today) && s.sale_type !== 'proforma');
            
            return {
                today: todaySales.reduce((sum, s) => sum + (s.total_price || 0), 0),
                week: 0, 
                month: 0,
                count: todaySales.length
            };
        } catch (error) {
            console.error('getDailyRevenue error:', error);
            return { today: 0, week: 0, month: 0, count: 0 };
        }
    }

    async getWorkerPerformance(storeId: string): Promise<WorkerStats[]> {
        try {
            const { isLocalFirst } = getDataClient();
            let sales: any[] = [];

            if (isLocalFirst) {
                sales = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/sales?store_id=${storeId}`, { method: 'GET' });
            } else {
                sales = await LocalDatabase.getSales(storeId);
            }

            const { OfflineTeamService } = await import('./OfflineTeamService');
            const { data: users } = await OfflineTeamService.getAllUsers();
            const nameMap = (users || []).reduce((acc, u) => ({ ...acc, [u.id]: u.full_name }), {} as Record<string, string>);

            const workerMap: Record<string, WorkerStats> = {};
            sales.filter(s => s.sale_type !== 'proforma').forEach(sale => {
                const workerId = sale.worker_id || 'unknown';
                if (!workerMap[workerId]) {
                    workerMap[workerId] = { 
                        id: workerId, 
                        name: nameMap[workerId] || workerId, 
                        sales_count: 0, 
                        revenue: 0 
                    };
                }
                workerMap[workerId].sales_count++;
                workerMap[workerId].revenue += Number(sale.total_price || 0);
            });

            return Object.values(workerMap).sort((a, b) => b.revenue - a.revenue);
        } catch (error) {
            console.error('getWorkerPerformance error:', error);
            return [];
        }
    }

    async getProductPerformance(storeId: string): Promise<ProductPerformance[]> {
        try {
            const { isLocalFirst } = getDataClient();
            let sales: any[] = [];

            if (isLocalFirst) {
                sales = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/sales?store_id=${storeId}`, { method: 'GET' });
            } else {
                sales = await LocalDatabase.getSales(storeId);
            }

            const prodMap: Record<string, ProductPerformance> = {};
            sales.filter(s => s.sale_type !== 'proforma').forEach(sale => {
                const items = (sale.items?.length ? sale.items : sale.sale_items) || [];
                items.forEach((item: any) => {
                    const pid = item.product_id || 'unknown';
                    if (!prodMap[pid]) {
                        prodMap[pid] = { id: pid, name: item.product_name, quantity: 0, revenue: 0 };
                    }
                    prodMap[pid].quantity += Number(item.quantity || 0);
                    prodMap[pid].revenue += Number(item.total || 0);
                });
            });

            return Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        } catch (error) {
            console.error('getProductPerformance error:', error);
            return [];
        }
    }

    async getStockValuation(storeId: string): Promise<{ total_cost: number; total_retail: number; item_count: number }> {
        try {
            const { isLocalFirst } = getDataClient();
            if (isLocalFirst) {
                const result = await OfflineAuthService.localBridgeRequest<any>(`/rest/v1/analytics/stock-valuation?store_id=${storeId}`, { method: 'GET' });
                if (result) return result;
            }
            
            // Fallback to manual calculation if bridge fails
            const payload = await OfflineAuthService.localBridgeRequest<any>(`/rest/v1/products?store_id=${storeId}&limit=1000`, { method: 'GET' });
            const products = Array.isArray(payload) ? payload : (payload.data || []);
            
            return products.reduce((acc, p) => {
                const qty = Number(p.quantity ?? p.stock ?? 0);
                return {
                    total_cost: acc.total_cost + (qty * Number(p.cost_price ?? p.cost ?? 0)),
                    total_retail: acc.total_retail + (qty * Number(p.unit_price ?? p.price ?? 0)),
                    item_count: acc.item_count + 1
                };
            }, { total_cost: 0, total_retail: 0, item_count: 0 });
        } catch (error) {
            console.error('getStockValuation error:', error);
            return { total_cost: 0, total_retail: 0, item_count: 0 };
        }
    }

    async getSales(storeId: string, from?: Date, to?: Date): Promise<SaleWithItems[]> {
        try {
            const { isLocalFirst } = getDataClient();
            if (isLocalFirst) {
                const params = new URLSearchParams({ store_id: storeId });
                if (from) params.append('date_from', from.toISOString());
                if (to) params.append('date_to', to.toISOString());
                return await OfflineAuthService.localBridgeRequest<SaleWithItems[]>(`/rest/v1/sales?${params.toString()}`, { method: 'GET' });
            }
            const sales = await LocalDatabase.getSales(storeId);
            return sales as unknown as SaleWithItems[];
        } catch (error) {
            console.error('getSales error:', error);
            throw error;
        }
    }

    async getClients(storeId: string): Promise<any[]> {
        const { isLocalFirst } = getDataClient();
        if (isLocalFirst) {
            return await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/clients?store_id=${storeId}`, { method: 'GET' });
        }
        return await LocalDatabase.getSuppliers(storeId);
    }

    async getSupplierPayments(storeId: string, from?: Date): Promise<any[]> {
        const { isLocalFirst } = getDataClient();
        if (isLocalFirst) {
            const params = new URLSearchParams({ store_id: storeId });
            if (from) params.append('date_from', from.toISOString());
            return await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/supplier_payments?${params.toString()}`, { method: 'GET' });
        }
        return await LocalDatabase.getSupplierPayments(storeId);
    }

    async getCashClosings(storeId: string): Promise<any[]> {
        const { isLocalFirst } = getDataClient();
        if (isLocalFirst) {
            return await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/cash_closings?store_id=${storeId}`, { method: 'GET' });
        }
        return await LocalDatabase.getCashClosings(storeId);
    }

    async getClientTransactions(storeId: string, clientId: string): Promise<any[]> {
        const { isLocalFirst } = getDataClient();
        if (isLocalFirst) {
            return await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/client_transactions?store_id=${storeId}&client_id=${clientId}`, { method: 'GET' });
        }
        return [];
    }

    async getSupplierTransactions(storeId: string, supplierId: string): Promise<any[]> {
        const { isLocalFirst } = getDataClient();
        if (isLocalFirst) {
            return await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/supplier_transactions?store_id=${storeId}&supplier_id=${supplierId}`, { method: 'GET' });
        }
        return [];
    }

    async getStockMovements(storeId: string): Promise<{ movements: any[]; offlineMessage?: string }> {
        try {
            const { isLocalFirst } = getDataClient();
            if (isLocalFirst) {
                const data = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/inventory_movements?store_id=${storeId}`, { method: 'GET' });
                return { movements: data };
            }
            return { movements: [], offlineMessage: "Connectez-vous au pont local." };
        } catch (error) {
            console.error('getStockMovements error:', error);
            return { movements: [], offlineMessage: "Erreur de chargement." };
        }
    }

    async updateProductStock(storeId: string, productId: string, newQuantity: number, reason: string): Promise<void> {
        console.log('[OfflineDataService] updateProductStock request:', { storeId, productId, newQuantity, reason });
        
        const { isLocalFirst } = getDataClient();
        if (isLocalFirst) {
            await OfflineAuthService.localBridgeRequest('/rest/v1/inventory_movements', {
                method: 'POST',
                body: JSON.stringify({ 
                    store_id: storeId, product_id: productId,
                    movement_type: 'adjustment',
                    quantity: Number(newQuantity),
                    reason: reason,
                    source: 'manual'
                })
            });
        }
    }

    async getDashboardAnalytics(storeId: string, from: Date, to: Date): Promise<any | null> {
        try {
            const { isLocalFirst } = getDataClient();
            if (isLocalFirst) {
                const params = new URLSearchParams({ 
                    store_id: storeId,
                    from: from.toISOString(),
                    to: to.toISOString()
                });
                const result = await OfflineAuthService.localBridgeRequest<any>(`/rest/v1/analytics/dashboard?${params.toString()}`, { method: 'GET' });
                if (result) return result;
            }
            
            // FRONTEND FALLBACK: Compute analytics manually
            const sales = await this.getSales(storeId, from, to);
            const { OfflineInventoryService } = await import('./OfflineInventoryService');
            const { data: products } = await OfflineInventoryService.getInventory(storeId);
            
            const today = new Date().toISOString().split('T')[0];
            const todaySales = sales.filter(s => s.created_at && s.created_at.startsWith(today) && s.sale_type !== 'proforma');
            
            // Compute top products
            const prodMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
            sales.filter(s => s.sale_type !== 'proforma').forEach(s => {
                const items = (s.items?.length ? s.items : s.sale_items) || [];
                items.forEach((item: any) => {
                    const name = item.product_name || 'Unknown';
                    if (!prodMap[name]) prodMap[name] = { name, quantity: 0, revenue: 0 };
                    prodMap[name].quantity += Number(item.quantity || 0);
                    prodMap[name].revenue += Number(item.total || 0);
                });
            });
            const top_products = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

            // Compute top workers
            const workerMap: Record<string, { name: string; sales_count: number; revenue: number }> = {};
            sales.filter(s => s.sale_type !== 'proforma').forEach(s => {
                const name = s.worker_id || 'Inconnu';
                if (!workerMap[name]) workerMap[name] = { name, sales_count: 0, revenue: 0 };
                workerMap[name].sales_count++;
                workerMap[name].revenue += Number(s.total_price || 0);
            });
            const top_workers = Object.values(workerMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

            // Compute stock health
            const stock_health = (products || []).reduce((acc, p) => {
                const qty = Number(p.quantity || 0);
                const threshold = Number(p.min_quantity || p.low_stock_threshold || 10);
                if (qty <= 0) acc.out++;
                else if (qty <= threshold) acc.low++;
                else acc.ok++;
                return acc;
            }, { ok: 0, low: 0, out: 0 });

            // Basic weekly revenue (last 7 days from "to")
            const weekly_revenue = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(to);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const dayTotal = sales
                    .filter(s => s.created_at.startsWith(dateStr) && s.sale_type !== 'proforma')
                    .reduce((sum, s) => sum + Number(s.total_price || 0), 0);
                weekly_revenue.push({ date: dateStr, revenue: dayTotal });
            }

            return {
                daily_revenue: todaySales.reduce((sum, s) => sum + (s.total_price || 0), 0),
                weekly_revenue,
                top_products,
                top_workers,
                stock_health
            };
        } catch (error) {
            console.error('getDashboardAnalytics error:', error);
            return null;
        }
    }

    async getCashTransactions(storeId: string, from?: Date): Promise<any[]> {
        const { isLocalFirst } = getDataClient();
        if (isLocalFirst) {
            const params = new URLSearchParams({ store_id: storeId });
            if (from) params.append('from', from.toISOString());
            return await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/cash_transactions?${params.toString()}`, { method: 'GET' });
        }
        return [];
    }

    async getPurchaseOrders(storeId: string, from?: Date, to?: Date): Promise<any[]> {
        const { isLocalFirst } = getDataClient();
        if (isLocalFirst) {
            const params = new URLSearchParams({ store_id: storeId });
            if (from) params.append('date_from', from.toISOString());
            if (to) params.append('date_to', to.toISOString());
            return await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/purchase_orders?${params.toString()}`, { method: 'GET' });
        }
        return [];
    }
    async getAllPurchaseItems(storeId: string, from?: Date, to?: Date): Promise<any[]> {
        const { isLocalFirst } = getDataClient();
        if (isLocalFirst) {
            const params = new URLSearchParams({ store_id: storeId });
            if (from) params.append('date_from', from.toISOString());
            if (to) params.append('date_to', to.toISOString());
            return await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/purchase_order_items?${params.toString()}`, { method: 'GET' });
        }
        return [];
    }
}

export const OfflineDataService = new OfflineDataServiceClass();
