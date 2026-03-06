import { supabase } from "@/integrations/supabase/client";
import { LocalDatabase } from "./LocalDatabase";
import { CartItem } from "@/stores/usePOSStore";
import { getDataClient, smartFetch } from "@/lib/dataClient";
import { OfflineAuthService } from "./OfflineAuthService";

export interface CreateSalePayload {
    store_id: string;
    worker_id: string;
    items: CartItem[];
    total_price: number;
    payment_method: 'cash' | 'card' | 'credit';
    sale_type: 'detail' | 'gros' | 'proforma';
    payment_status?: 'paid' | 'pending';
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    client_id?: string;
    discount?: number;
    invoice_number?: string;
    order_ref?: string;
}

export class OfflineSalesService {

    /**
     * Create a new sale (Local First -> Network)
     */
    static async createSale(payload: CreateSalePayload) {
        const saleId = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        const flattenedItems = payload.items.map((item) => ({
            product_id: item.product?.id || (item as any).product_id || null,
            product_name: item.product?.name || (item as any).product_name || 'Unknown',
            quantity: item.quantity,
            unit_price: item.unitPrice || item.product?.unit_price || 0,
            discount: item.discount || 0,
            total: item.total || item.lineTotal || 0,
        }));
        
        const defaultPaymentStatus = payload.sale_type === 'proforma' || payload.payment_method === 'credit' ? 'pending' : 'paid';

        const localSale = {
            id: saleId,
            ...payload,
            payment_status: payload.payment_status || defaultPaymentStatus,
            items: flattenedItems,
            created_at: timestamp,
            synced: false
        };

        try {
            const dataClient = getDataClient();
            const useLocalBridge = dataClient.isLocalFirst;
            // 1. Save to LocalDB immediately
            await LocalDatabase.init();
            await LocalDatabase.saveSale(localSale);

            // 2. Try to sync if online
            if (navigator.onLine) {
                if (useLocalBridge) {
                    const headers = await OfflineAuthService.getAuthHeaders();
                    if (!headers) {
                        return { data: { id: saleId, offline: true }, error: null };
                    }
                    const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/sales`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...headers },
                        body: JSON.stringify({
                            id: saleId,
                            store_id: payload.store_id,
                            worker_id: payload.worker_id,
                            client_id: payload.client_id || null,
                            customer_name: payload.customer_name || null,
                            customer_phone: payload.customer_phone || null,
                            customer_address: payload.customer_address || null,
                            sale_type: payload.sale_type,
                            total_price: payload.total_price,
                            payment_method: payload.payment_method,
                            payment_status: localSale.payment_status,
                            discount: payload.discount || 0,
                            invoice_number: payload.invoice_number,
                            order_ref: payload.order_ref,
                            created_at: timestamp,
                        items: payload.items.map((item) => ({
                            id: (item as any).id || crypto.randomUUID(),
                            product_id: item.product?.id || null,
                            product_name: item.product?.name || 'Unknown',
                            quantity: item.quantity,
                            unit_price: item.unitPrice || item.product?.unit_price || 0,
                            discount: item.discount || 0,
                            total: item.total || item.lineTotal || 0,
                        })),
                        }),
                    });
                    if (response.ok) {
                        await LocalDatabase.markSaleSynced(saleId);
                        return { data: { id: saleId }, error: null };
                    }
                    // Fall through to queue on failure
                }

                const { error } = await this.syncSaleToSupabase(localSale);

                if (!error) {
                    // Mark as synced locally
                    await LocalDatabase.markSaleSynced(saleId);
                    return { data: { id: saleId }, error: null };
                } else {
                    console.warn('Sync failed, queued for later:', error);
                    // Fallback to queue
                }
            }

            // 3. Queue for background sync if offline or failed
            await LocalDatabase.addToSyncQueue({
                id: crypto.randomUUID(),
                type: 'sale',
                data: localSale,
                timestamp: Date.now(),
                retries: 0
            });

            return { data: { id: saleId, offline: true }, error: null };

        } catch (err) {
            console.error('OfflineSalesService error:', err);
            return { data: null, error: err };
        }
    }

    static async createSaleWithItems(
        sale: any,
        items: any[]
    ): Promise<{ data?: any; error?: any }> {
        const cartItems: any[] = items.map(item => ({
            product: { id: item.product_id, name: item.product_name, unit_price: item.unit_price },
            quantity: item.quantity,
            total: item.total,
            discount: item.discount || 0
        }));
        return this.createSale({
            store_id: sale.store_id,
            worker_id: sale.worker_id,
            items: cartItems,
            total_price: Number(sale.total_price),
            sale_type: sale.sale_type || 'detail',
            payment_method: sale.payment_method || 'cash',
            customer_name: sale.customer_name || undefined,
            customer_phone: sale.customer_phone || undefined,
        });
    }

    static async updateSale(id: string, updates: any): Promise<{ data?: any; error?: any }> {
        try {
            const dataClient = (await import('@/lib/dataClient')).getDataClient();
            if (dataClient.isLocalFirst) {
                const { OfflineAuthService } = await import('./OfflineAuthService');
                const headers = await OfflineAuthService.getAuthHeaders();
                if (!headers) {
                    return { error: { message: 'Local session required.' } };
                }
                const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/sales/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...headers },
                    body: JSON.stringify(updates),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) return { error: payload };
                return { data: payload };
            }

            const { data, error } = await supabase
                .from('sales')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            return { data, error };
        } catch (error) {
            return { error };
        }
    }

    /**
     * Sync a single sale to Supabase
     */
    private static async syncSaleToSupabase(sale: any) {
        // Get first item for required item_id field  
        const firstItem = sale.items?.[0];
        
        // 1. Create Sale Record with required item_id
        const { data: saleRecord, error: saleError } = await supabase
            .from('sales')
            .insert([{
                id: sale.id, // Use same ID to prevent dupes
                store_id: sale.store_id,
                worker_id: sale.worker_id,
                item_id: firstItem?.product?.id || firstItem?.product_id || 'unknown',
                unit_price: firstItem?.product?.unit_price || firstItem?.unit_price || 0,
                quantity: sale.items?.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0) || 1,
                total_price: sale.total_price,
                customer_name: sale.customer_name,
                customer_phone: sale.customer_phone,
                notes: null,
                created_at: sale.created_at
            }])
            .select()
            .single();

        if (saleError) return { error: saleError };

        // 2. Create Sale Items
        const saleItems = sale.items.map((item: CartItem) => ({
            sale_id: sale.id,
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            unit_price: item.product.unit_price,
            total: item.total,
            discount: item.discount
        }));

        const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(saleItems);

        if (itemsError) {
            // If items fail, we might want to rollback the sale? 
            // For now, let's just log it. Supabase transaction would be better here.
            console.error('Failed to insert sale items:', itemsError);
            return { error: itemsError };
        }

        return { data: saleRecord };
    }

    /**
     * Process the Sync Queue
     */
    static async processSyncQueue() {
        if (!navigator.onLine) return; // Don't try if offline

        await LocalDatabase.init();
        const queue = await LocalDatabase.getSyncQueue();
        const salesQueue = queue.filter(item => item.type === 'sale');

        console.log(`Processing ${salesQueue.length} queued sales...`);

        for (const item of salesQueue) {
            const sale = item.data;
            const { error } = await this.syncSaleToSupabase(sale);

            if (!error) {
                // Success: Remove from queue and mark local sale as synced
                await LocalDatabase.removeFromSyncQueue(item.id);
                await LocalDatabase.markSaleSynced(sale.id);
            } else {
                // Failed: Increment retry count? Or leave it for next time.
                console.error(`Failed to sync queued sale ${sale.id}:`, error);
            }
        }
    }

    /**
     * Get Daily Sales (Merged Local + Remote if needed, but usually just Local is enough for POS)
     */
    static async getDailySales(storeId: string) {
        await LocalDatabase.init();
        const sales = await LocalDatabase.getSales(storeId);

        // Filter for today
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const dailySales = sales.filter(s => s.created_at.startsWith(today));

        return dailySales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    /**
     * Get Proformas (Merged Local + Remote)
     */
    static async getProformas(storeId: string) {
        if (!storeId) return [];
        await LocalDatabase.init();
        const sales = await LocalDatabase.getSales(storeId);

        // Filter for proformas
        const proformas = sales.filter(s => s.sale_type === 'proforma');

        return proformas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    /**
     * Get sales from local database (optionally filtered by store and date range)
     */
    static async getSales(storeId?: string, dateFrom?: Date, dateTo?: Date) {
        const dataClient = getDataClient();
        if (dataClient.isLocalFirst) {
            const headers = await OfflineAuthService.getAuthHeaders();
            if (headers) {
                const params = new URLSearchParams();
                if (storeId) params.set('store_id', storeId);
                if (dateFrom) params.set('date_from', dateFrom.toISOString());
                if (dateTo) params.set('date_to', dateTo.toISOString());

                const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/sales?${params.toString()}`, {
                    headers
                });
                if (response.ok) {
                    return await response.json();
                }
            }
        }

        await LocalDatabase.init();
        let sales = await LocalDatabase.getSales(storeId);
        
        if (dateFrom) {
            sales = sales.filter(s => new Date(s.created_at) >= dateFrom);
        }
        if (dateTo) {
            sales = sales.filter(s => new Date(s.created_at) <= dateTo);
        }
        
        return sales;
    }

    static async deleteSale(id: string): Promise<{ error?: any }> {
        try {
            const dataClient = getDataClient();
            if (dataClient.isLocalFirst) {
                const headers = await OfflineAuthService.getAuthHeaders();
                if (!headers) {
                    return { error: { message: 'Local session required.' } };
                }
                const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/sales/${id}`, {
                    method: 'DELETE',
                    headers: { ...headers },
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    return { error: payload };
                }
                return {};
            }

            // Delete sale items first (cascade)
            await supabase.from('sale_items').delete().eq('sale_id', id);

            const { error } = await supabase
                .from('sales')
                .delete()
                .eq('id', id);

            return { error };
        } catch (error) {
            return { error };
        }
    }

    static async getSalesMetrics(storeId?: string): Promise<{
        todaySales: number;
        weekSales: number;
        monthSales: number;
        error?: any;
    }> {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const { OfflineDataService } = await import('./OfflineDataService');
            // OfflineDataService.getSales handles Supabase, LocalBridge and LocalDatabase merging securely
            const sales = await OfflineDataService.getSales(storeId || '');

            const todaySales = sales
                .filter((sale) => new Date(sale.created_at) >= todayStart)
                .reduce((sum, sale) => sum + Number(sale.total_price), 0);

            const weekSales = sales
                .filter((sale) => new Date(sale.created_at) >= weekStart)
                .reduce((sum, sale) => sum + Number(sale.total_price), 0);

            const monthSales = sales
                .filter((sale) => new Date(sale.created_at) >= monthStart)
                .reduce((sum, sale) => sum + Number(sale.total_price), 0);

            return { todaySales, weekSales, monthSales };
        } catch (error) {
            console.error('Error calculating sales metrics:', error);
            return { todaySales: 0, weekSales: 0, monthSales: 0, error };
        }
    }
}
