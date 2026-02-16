import { supabase } from "@/integrations/supabase/client";
import { LocalDatabase } from "./LocalDatabase";
import { CartItem } from "@/stores/usePOSStore";
import { getDataClient } from "@/lib/dataClient";
import { OfflineAuthService } from "./OfflineAuthService";

export interface CreateSalePayload {
    store_id: string;
    worker_id: string;
    items: CartItem[];
    total_price: number;
    payment_method: 'cash' | 'card' | 'credit';
    sale_type: 'detail' | 'gros' | 'proforma';
    customer_name?: string;
    customer_phone?: string;
}

export class OfflineSalesService {

    /**
     * Create a new sale (Local First -> Network)
     */
    static async createSale(payload: CreateSalePayload) {
        const saleId = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        const localSale = {
            id: saleId,
            ...payload,
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
                    const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/sales`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...headers },
                        body: JSON.stringify({
                            store_id: payload.store_id,
                            worker_id: payload.worker_id,
                            customer_name: payload.customer_name || null,
                            customer_phone: payload.customer_phone || null,
                            sale_type: payload.sale_type,
                            total_price: payload.total_price,
                            payment_method: payload.payment_method,
                            payment_status: 'paid',
                        items: payload.items.map((item) => ({
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
     * Get sales from local database (optionally filtered by store)
     */
    static async getSales(storeId?: string) {
        await LocalDatabase.init();
        return LocalDatabase.getSales(storeId);
    }
}
