import { LocalDatabase } from "./LocalDatabase";
import { getDataClient } from "@/lib/dataClient";
import { OfflineAuthService } from "./OfflineAuthService";
import { supabase } from "@/lib/supabase";

export const OfflineSalesService = {
    /**
     * Create a sale with items atomically
     */
    async createSaleWithItems(sale: any, items: any[]): Promise<{ data?: any; error?: any }> {
        return this.createSale(sale, items);
    },

    async createSale(sale: any, items?: any[]): Promise<{ data?: any; error?: any }> {
        const { isLocalFirst } = getDataClient();
        const saleItems = items || sale.items || [];
        
        // Map cart items to standard schema shape
        const mappedItems = saleItems.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            product_id: item.product_id || item.productId || item.product?.id || null,
            product_name: item.product_name || item.productName || item.designation || item.product?.name || 'Unknown',
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price ?? item.unitPrice ?? 0),
            discount: Number(item.discount ?? item.discountPercent ?? 0),
            total: Number(item.total ?? item.lineTotal ?? 0),
        }));

        let localResult: any = null;
        let localError: any = null;

        if (isLocalFirst) {
            try {
                const payload = { ...sale, items: mappedItems };
                console.log('[OfflineSales] Sending sale to bridge:', payload);

                const result = await OfflineAuthService.localBridgeRequest<any>('/rest/v1/sales', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                console.log('[OfflineSales] Sale saved successfully via bridge:', result);
                localResult = result;
            } catch (error) {
                console.error('[OfflineSales] Create sale failed locally:', error);
                localError = error;
            }
        } else {
            // Web Fallback (Save to local IndexedDB)
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

        // Direct online write to Supabase if connected in Cloud Mode
        if (!isLocalFirst && navigator.onLine && !localError) {
            try {
                const saleId = sale.id || localResult?.id;
                const now = new Date().toISOString();

                const mappedSale = {
                    id: saleId,
                    store_id: sale.store_id || localStorage.getItem('worker_store_id') || null,
                    worker_id: sale.worker_id || null,
                    client_id: sale.client_id || null,
                    customer_name: sale.customer_name || null,
                    customer_phone: sale.customer_phone || null,
                    sale_type: sale.sale_type || 'detail',
                    total_price: Number(sale.total_price || sale.total || 0),
                    amount_paid: Number(sale.amount_paid || sale.total_price || 0),
                    discount: Number(sale.discount || 0),
                    tax: Number(sale.tax || 0),
                    payment_method: sale.payment_method || 'cash',
                    payment_status: sale.payment_status || 'paid',
                    notes: sale.notes || null,
                    invoice_number: sale.invoice_number || null,
                    version: Number(sale.version || 1),
                    created_at: sale.created_at || now,
                    updated_at: now,
                };

                const mappedItemsForSupa = mappedItems.map((item: any) => ({
                    id: item.id,
                    sale_id: saleId,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount: item.discount,
                    total: item.total,
                    created_at: now
                }));

                console.log('[OfflineSales] Writing to Supabase sales:', mappedSale, mappedItemsForSupa);

                const { error: saleErr } = await supabase
                    .from('sales')
                    .upsert(mappedSale);

                if (saleErr) throw saleErr;

                if (mappedItemsForSupa.length > 0) {
                    const { error: itemsErr } = await supabase
                        .from('sale_items')
                        .upsert(mappedItemsForSupa);
                    if (itemsErr) throw itemsErr;
                }

                console.log('[OfflineSales] Supabase save successful for sale:', saleId);
                
                // Mark locally as synced
                if (localResult) {
                    localResult.synced = true;
                    await LocalDatabase.saveSale(localResult);
                }
            } catch (supaErr) {
                console.error('[OfflineSales] Supabase write failed:', supaErr);
            }
        }

        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
        if (localError) return { error: localError };
        return { data: localResult };
    },

    async updateSale(saleId: string, updates: any): Promise<{ data?: any; error?: any }> {
        const { isLocalFirst } = getDataClient();
        let localResult: any = null;
        let localError: any = null;
        const now = new Date().toISOString();

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

        // Direct online update to Supabase in Cloud Mode
        if (!isLocalFirst && navigator.onLine && !localError) {
            try {
                const mappedUpdates: any = {};
                if (updates.payment_status !== undefined) mappedUpdates.payment_status = updates.payment_status;
                if (updates.amount_paid !== undefined) mappedUpdates.amount_paid = Number(updates.amount_paid);
                if (updates.notes !== undefined) mappedUpdates.notes = updates.notes;
                mappedUpdates.updated_at = now;

                if (Object.keys(mappedUpdates).length > 0) {
                    console.log('[OfflineSales] Updating Supabase sale:', saleId, mappedUpdates);
                    const { error: supaErr } = await supabase
                        .from('sales')
                        .update(mappedUpdates)
                        .eq('id', saleId);

                    if (supaErr) {
                        console.error('[OfflineSales] Supabase sale update failed:', supaErr);
                    } else {
                        if (localResult) {
                            localResult.synced = true;
                            await LocalDatabase.saveSale(localResult);
                        }
                    }
                }
            } catch (supaErr) {
                console.error('[OfflineSales] Supabase sale update exception:', supaErr);
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
                await OfflineAuthService.localBridgeRequest(`/rest/v1/sales/${saleId}`, {
                    method: 'DELETE'
                });
            } else {
                await LocalDatabase.init();
                const sales = await LocalDatabase.getSales();
                const existing = sales.find((sale: any) => sale.id === saleId);
                if (existing) {
                    await LocalDatabase.saveSale({
                        ...existing,
                        deleted_at: new Date().toISOString(),
                        synced: false
                    });
                }
                
                if (navigator.onLine) {
                  try {
                    const { error } = await supabase
                      .from('sales')
                      .delete()
                      .eq('id', saleId);
                    if (error) throw error;
                    
                    if (existing) {
                      await LocalDatabase.saveSale({
                          ...existing,
                          deleted_at: new Date().toISOString(),
                          synced: true
                      });
                    }
                  } catch (e) {
                    console.warn('[OfflineSales] Cloud delete failed, queued offline:', e);
                  }
                }
            }
            
            window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
            window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
            return { success: true };
        } catch (error) {
            console.error('deleteSale error:', error);
            return { success: false, error };
        }
    },
    
    async getSales(storeId: string): Promise<any[]> {
      const { isLocalFirst } = getDataClient();
      await LocalDatabase.init();

      if (!isLocalFirst && navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('sales')
            .select('*, sale_items(*)')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          if (data) {
            const mapped = data.map((sale: any) => ({
              ...sale,
              items: (sale.sale_items || []).map((item: any) => ({
                id: item.id,
                sale_id: item.sale_id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                discount: Number(item.discount),
                total: Number(item.total)
              })),
              synced: true
            }));

            // Sync to local cache async
            (async () => {
              try {
                for (const s of mapped) {
                  await LocalDatabase.saveSale(s);
                }
              } catch (e) {
                console.warn('[OfflineSales] Cache save failed:', e);
              }
            })();

            return mapped;
          }
        } catch (e) {
          console.warn('[OfflineSales] Supabase fetch failed, using local database cache:', e);
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
            const sales = await this.getSales(storeId);

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
    },

    async getProformas(storeId: string): Promise<any[]> {
        const sales = await this.getSales(storeId);
        return sales.filter((s: any) => s.sale_type === 'proforma');
    }
}
