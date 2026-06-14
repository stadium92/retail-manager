import { LocalDatabase } from "./LocalDatabase";
import { getDataClient } from "@/lib/dataClient";
import { OfflineAuthService } from "./OfflineAuthService";
import { supabase } from "@/lib/supabase";
import { SupabaseSyncService } from "./SupabaseSyncService";

export const OfflineSalesService = {
    /**
     * Create a sale with items atomically on the local bridge
     */
    async createSaleWithItems(sale: any, items: any[]): Promise<{ data?: any; error?: any }> {
        const { isLocalFirst } = getDataClient();
        let localResult: any;
        let localError: any;
        
        // 1. Map and write items locally
        const mappedItems = items.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            product_id: item.product_id || item.productId || item.product?.id || null,
            product_name: item.product_name || item.productName || item.designation || item.product?.name || 'Unknown',
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price ?? item.unitPrice ?? 0),
            discount: Number(item.discount ?? item.discountPercent ?? 0),
            total: Number(item.total ?? item.lineTotal ?? 0),
        }));

        if (isLocalFirst) {
            try {
                const payload = { ...sale, items: mappedItems };
                console.log('[OfflineSales] Sending sale to bridge:', payload);

                const result = await OfflineAuthService.localBridgeRequest<any>('/rest/v1/sales', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                console.log('[OfflineSales] Sale saved locally:', result);
                localResult = result;
            } catch (error) {
                console.error('[OfflineSales] Create sale failed locally:', error);
                localError = error;
            }
        } else {
            // Web Fallback (True Offline)
            try {
                await LocalDatabase.init();
                const saleId = sale.id || crypto.randomUUID();
                const newSale = { ...sale, id: saleId, items: mappedItems, synced: false };
                await LocalDatabase.saveSale(newSale);
                localResult = newSale;
            } catch (error) {
                localError = error;
            }
        }

        // 2. Direct online write to Supabase if connected
        if (navigator.onLine && !localError) {
            try {
                const storeId = sale.store_id || localStorage.getItem('worker_store_id');
                const saleId = sale.id || localResult?.id;

                const mappedSale = {
                    id: saleId,
                    restaurant_id: storeId,
                    worker_id: sale.worker_id || null,
                    waiter_id: sale.waiter_id || null,
                    customer_name: sale.customer_name || null,
                    customer_phone: sale.customer_phone || null,
                    order_type: sale.order_type || 'dine_in',
                    status: sale.order_status || sale.status || 'pending',
                    total_price: sale.total_price || sale.total || 0,
                    discount: sale.discount || 0,
                    tax: sale.tax || 0,
                    payment_method: sale.payment_method || 'cash',
                    payment_status: sale.payment_status || 'unpaid',
                    notes: sale.notes || null,
                    invoice_number: sale.invoice_number || null,
                    table_number: sale.table_number || null,
                    kitchen_notes: sale.kitchen_notes || null,
                    estimated_prep_time: sale.estimated_prep_time || null,
                    created_at: sale.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                const mappedItemsForSupa = mappedItems.map((item: any) => ({
                    id: item.id,
                    order_id: saleId,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount: item.discount,
                    total: item.total,
                    modifiers: item.modifiers ? (typeof item.modifiers === 'string' ? JSON.parse(item.modifiers) : item.modifiers) : [],
                    status: item.status || 'pending',
                    created_at: new Date().toISOString(),
                }));

                console.log('[OfflineSales] Writing to Supabase:', mappedSale, mappedItemsForSupa);

                const { error: saleErr } = await supabase
                    .from('orders')
                    .upsert(mappedSale);

                if (saleErr) throw saleErr;

                if (mappedItemsForSupa.length > 0) {
                    const { error: itemsErr } = await supabase
                        .from('order_items')
                        .upsert(mappedItemsForSupa);
                    if (itemsErr) throw itemsErr;
                }

                console.log('[OfflineSales] Supabase save successful for sale:', saleId);

                // Trigger immediate push of outbox if there are pending mutations
                if (isLocalFirst && storeId) {
                    SupabaseSyncService.pushPendingMutations(storeId).catch(console.error);
                }
            } catch (supaErr) {
                console.error('[OfflineSales] Supabase write failed:', supaErr);
            }
        }

        // Centralized event dispatch to ensure UI reactivity
        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));

        if (localError) return { error: localError };
        return { data: localResult };
    },

    async updateSale(saleId: string, updates: any): Promise<{ data?: any; error?: any }> {
        const { isLocalFirst } = getDataClient();
        let localResult: any;
        let localError: any;

        // 1. Update local database
        if (isLocalFirst) {
            try {
                const response = await OfflineAuthService.localBridgeRequest<any>(`/rest/v1/sales/${saleId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updates)
                });
                localResult = response;
            } catch (error) {
                console.error('[OfflineSales] Update sale failed locally:', error);
                localError = error;
            }
        } else {
            try {
                await LocalDatabase.init();
                const sales = await LocalDatabase.getSales();
                const existingSale = sales.find((sale: any) => sale.id === saleId);
                if (!existingSale) {
                    localError = 'Sale not found.';
                } else {
                    const updatedSale = { ...existingSale, ...updates, synced: false };
                    await LocalDatabase.saveSale(updatedSale);
                    localResult = updatedSale;
                }
            } catch (error) {
                localError = error;
            }
        }

        // 2. Update Supabase directly if online
        if (navigator.onLine && !localError) {
            try {
                const mappedUpdates: any = {};
                if (updates.order_status !== undefined) mappedUpdates.status = updates.order_status;
                if (updates.status !== undefined) mappedUpdates.status = updates.status;
                if (updates.payment_status !== undefined) mappedUpdates.payment_status = updates.payment_status;
                if (updates.amount_paid !== undefined) mappedUpdates.amount_paid = updates.amount_paid;
                if (updates.served_at !== undefined) mappedUpdates.served_at = updates.served_at;
                if (updates.updated_at !== undefined) mappedUpdates.updated_at = updates.updated_at;
                if (updates.table_number !== undefined) mappedUpdates.table_number = updates.table_number;
                if (updates.kitchen_notes !== undefined) mappedUpdates.kitchen_notes = updates.kitchen_notes;

                if (Object.keys(mappedUpdates).length > 0) {
                    console.log('[OfflineSales] Updating Supabase sale:', saleId, mappedUpdates);
                    const { error: supaErr } = await supabase
                        .from('orders')
                        .update(mappedUpdates)
                        .eq('id', saleId);

                    if (supaErr) {
                        console.error('[OfflineSales] Supabase update failed:', supaErr);
                    } else {
                        console.log('[OfflineSales] Supabase update successful for:', saleId);
                        const storeId = localResult?.store_id || updates.store_id || localStorage.getItem('worker_store_id');
                        if (isLocalFirst && storeId) {
                            SupabaseSyncService.pushPendingMutations(storeId).catch(console.error);
                        }
                    }
                }
            } catch (supaErr) {
                console.error('[OfflineSales] Supabase update failed:', supaErr);
            }
        }

        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));

        if (localError) return { error: localError };
        return { data: localResult };
    },
    
    async deleteSale(saleId: string): Promise<{ success: boolean; error?: any }> {
        try {
            const { isLocalFirst } = getDataClient();
            if (isLocalFirst) {
                const response = await OfflineAuthService.localBridgeRequest(`/rest/v1/sales/${saleId}`, {
                    method: 'DELETE'
                });
                
                window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
                window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
                return { success: true };
            }
            return { success: false, error: 'Cannot delete offline.' };
        } catch (error) {
            console.error('deleteSale error:', error);
            return { success: false, error };
        }
    },
    
    async getSales(storeId: string): Promise<any[]> {
        const { isLocalFirst } = getDataClient();
        
        if (navigator.onLine) {
            try {
                console.log('[OfflineSalesService] Fetching sales from Supabase...');
                const { data, error } = await supabase
                    .from('orders')
                    .select('*, order_items(*)')
                    .eq('restaurant_id', storeId)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (error) throw error;

                const mapped = (data || []).map((sale: any) => {
                    const { order_items, ...rest } = sale;
                    return {
                        ...rest,
                        order_status: sale.status,
                        store_id: sale.restaurant_id,
                        items: (order_items || []).map((item: any) => ({
                            id: item.id,
                            sale_id: item.order_id,
                            product_id: item.product_id,
                            product_name: item.product_name,
                            quantity: Number(item.quantity),
                            unit_price: Number(item.unit_price),
                            discount: Number(item.discount),
                            total: Number(item.total),
                            modifiers: item.modifiers,
                            status: item.status,
                        })),
                    };
                });

                if (!isLocalFirst) {
                    await LocalDatabase.init();
                    for (const sale of mapped) {
                        await LocalDatabase.saveSale(sale);
                    }
                }

                return mapped;
            } catch (err) {
                console.warn('[OfflineSalesService] Fetch from Supabase failed, falling back to local:', err);
            }
        }

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

            if (navigator.onLine) {
                try {
                    sales = await this.getSales(storeId);
                } catch (e) {
                    console.warn('Failed to fetch sales for metrics from Supabase, falling back to local');
                }
            }

            if (!sales || sales.length === 0) {
                if (isLocalFirst) {
                    sales = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/sales?store_id=${storeId}`, { method: 'GET' });
                } else {
                    sales = await LocalDatabase.getSales(storeId);
                }
            }

            const today = new Date().toISOString().split('T')[0];
            const todaySales = sales
                .filter(s => s.created_at && s.created_at.startsWith(today) && s.sale_type !== 'proforma')
                .reduce((sum, s) => sum + (s.total_price || 0), 0);

            const weekSales = todaySales; 
            const monthSales = todaySales;

            return { todaySales, weekSales, monthSales };
        } catch (error) {
            console.error('Error calculating sales metrics:', error);
            return { todaySales: 0, weekSales: 0, monthSales: 0, error };
        }
    }
}
