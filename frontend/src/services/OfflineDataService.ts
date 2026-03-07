import { LocalDatabase } from "./LocalDatabase";
import { getDataClient, smartFetch } from "@/lib/dataClient";

interface DailyRevenue {
    today: number;
    week: number;
    month: number;
    count: number;
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
    sale_items?: any[];
    items?: any[];
}

export interface PurchaseWithSupplier {
    id: string;
    store_id: string;
    supplier_id?: string;
    supplier_name?: string;
    order_ref?: string;
    status: string;
    total_amount: number;
    notes?: string;
    created_at: string;
    updated_at: string;
    items?: any[];
}

export interface StockMovement {
    id: string;
    product_id: string;
    product_name?: string;
    movement_type: string;
    quantity: number;
    reason?: string;
    source?: string;
    created_at: string;
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
            const todaySales = sales.filter(s => s.created_at.startsWith(today) && s.sale_type !== 'proforma');
            
            return {
                today: todaySales.reduce((sum, s) => sum + (s.total_price || 0), 0),
                week: 0, // Simplified for brevity
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

            const { OfflineTeamService } = await import('./OfflineTeamService');
            const { data: users } = await OfflineTeamService.getTeam(storeId);
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

            const prodMap: Record<string, ProductPerformance> = {};
            sales.filter(s => s.sale_type !== 'proforma').forEach(sale => {
                (sale.items || []).forEach((item: any) => {
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
            const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
            let products: any[] = [];

            if (isLocalFirst) {
                const { OfflineAuthService } = await import('./OfflineAuthService');
                const headers = await OfflineAuthService.getAuthHeaders();
                if (headers) {
                    const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/products?store_id=${storeId}`, { headers });
                    if (res.ok) products = await res.json();
                    else throw new Error('Bridge unreachable');
                }
            } else {
                products = await LocalDatabase.getInventory(storeId);
            }

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

    async getClients(storeId: string): Promise<any[]> {
      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      if (isLocalFirst) {
        const { OfflineAuthService } = await import('./OfflineAuthService');
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/clients?store_id=${storeId}`, { headers });
          if (res.ok) return await res.json();
        }
        throw new Error('Bridge unreachable');
      }
      return await LocalDatabase.getSuppliers(storeId); // Note: Original code used getSuppliers for clients fallback
    }

    async getSupplierPayments(storeId: string): Promise<any[]> {
      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      if (isLocalFirst) {
        const { OfflineAuthService } = await import('./OfflineAuthService');
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/supplier_payments?store_id=${storeId}`, { headers });
          if (res.ok) return await res.json();
        }
        throw new Error('Bridge unreachable');
      }
      return await LocalDatabase.getSupplierPayments(storeId);
    }

    async getCashClosings(storeId: string): Promise<any[]> {
      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      if (isLocalFirst) {
        const { OfflineAuthService } = await import('./OfflineAuthService');
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/cash_closings?store_id=${storeId}`, { headers });
          if (res.ok) return await res.json();
        }
        throw new Error('Bridge unreachable');
      }
      return await LocalDatabase.getCashClosings(storeId);
    }

    async getStockMovements(storeId: string): Promise<{ movements: any[]; offlineMessage?: string }> {
      try {
          const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
          if (isLocalFirst) {
              const { OfflineAuthService } = await import('./OfflineAuthService');
              const headers = await OfflineAuthService.getAuthHeaders();
              if (headers) {
                  const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/inventory_movements?store_id=${storeId}`, { headers });
                  if (res.ok) {
                      const data = await res.json();
                      return { movements: data };
                  }
              }
              throw new Error('Bridge unreachable');
          }
          return { movements: [], offlineMessage: "Connectez-vous au pont local pour voir les mouvements." };
      } catch (error) {
          console.error('getStockMovements error:', error);
          return { movements: [], offlineMessage: "Erreur lors du chargement des mouvements." };
      }
    }

    async updateProductStock(productId: string, newQuantity: number, reason: string): Promise<void> {
      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      const { OfflineAuthService } = await import('./OfflineAuthService');
      
      if (isLocalFirst) {
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/inventory_movements`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  product_id: productId,
                  movement_type: 'adjustment',
                  quantity: newQuantity,
                  reason: reason,
                  source: 'manual'
              })
            });
            if (!res.ok) throw new Error('Failed to update stock on bridge');
          }
      }
    }

    async getSales(storeId: string, from?: Date, to?: Date): Promise<SaleWithItems[]> {
      try {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

        if (isLocalFirst) {
          const { OfflineAuthService } = await import('./OfflineAuthService');
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams({ store_id: storeId });
            if (from) params.append('date_from', from.toISOString());
            if (to) params.append('date_to', to.toISOString());
            const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/sales?${params.toString()}`, { headers });
            if (res.ok) return await res.json();
            throw new Error('Bridge unreachable');
          }
        }

        const sales = await LocalDatabase.getSales(storeId);
        return sales as unknown as SaleWithItems[];
      } catch (error) {
        console.error('getSales error:', error);
        return [];
      }
    }

    async getClientTransactions(storeId: string, clientId: string): Promise<any[]> {
      try {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

        if (isLocalFirst) {
          const { OfflineAuthService } = await import('./OfflineAuthService');
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams({ store_id: storeId, client_id: clientId });
            const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/client_transactions?${params.toString()}`, { headers });
            if (res.ok) return await res.json();
            throw new Error('Bridge unreachable');
          }
        }

        return [];
      } catch (error) {
        console.error('getClientTransactions error:', error);
        return [];
      }
    }

    async getSupplierTransactions(storeId: string, supplierId: string): Promise<any[]> {
      try {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

        if (isLocalFirst) {
          const { OfflineAuthService } = await import('./OfflineAuthService');
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams({ store_id: storeId, supplier_id: supplierId });
            const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/supplier_transactions?${params.toString()}`, { headers });
            if (res.ok) return await res.json();
            throw new Error('Bridge unreachable');
          }
        }

        return [];
      } catch (error) {
        console.error('getSupplierTransactions error:', error);
        return [];
      }
    }

    async getPurchaseOrders(storeId: string, from?: Date, to?: Date): Promise<PurchaseWithSupplier[]> {
      try {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

        if (isLocalFirst) {
          const { OfflineAuthService } = await import('./OfflineAuthService');
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams({ store_id: storeId });
            if (from) params.append('date_from', from.toISOString());
            if (to) params.append('date_to', to.toISOString());
            const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/purchase_orders?${params.toString()}`, { headers });
            if (res.ok) return await res.json();
            throw new Error('Bridge unreachable');
          }
        }

        return [];
      } catch (error) {
        console.error('getPurchaseOrders error:', error);
        return [];
      }
    }

    async getAllPurchaseItems(storeId: string, from?: Date, to?: Date): Promise<any[]> {
      try {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

        if (isLocalFirst) {
          const { OfflineAuthService } = await import('./OfflineAuthService');
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams({ store_id: storeId });
            if (from) params.append('date_from', from.toISOString());
            if (to) params.append('date_to', to.toISOString());
            const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/purchase_items?${params.toString()}`, { headers });
            if (res.ok) return await res.json();
            throw new Error('Bridge unreachable');
          }
        }

        return [];
      } catch (error) {
        console.error('getAllPurchaseItems error:', error);
        return [];
      }
    }

    async getDashboardAnalytics(storeId: string, from: Date, to: Date): Promise<any | null> {
      try {
        const [revenue, workerPerf, productPerf, valuation] = await Promise.all([
          this.getDailyRevenue(storeId),
          this.getWorkerPerformance(storeId),
          this.getProductPerformance(storeId),
          this.getStockValuation(storeId),
        ]);

        return {
          daily_revenue: revenue.today,
          weekly_revenue: [],
          top_products: productPerf.map(p => ({ name: p.name, quantity: p.quantity, revenue: p.revenue })),
          top_workers: workerPerf.map(w => ({ name: w.name, sales_count: w.sales_count, revenue: w.revenue })),
          stock_health: valuation ? {
            ok: Math.max(0, valuation.item_count - 0),
            low: 0,
            out: 0,
          } : undefined,
        };
      } catch (error) {
        console.error('getDashboardAnalytics error:', error);
        return null;
      }
    }

    async getCashTransactions(storeId: string, from?: Date): Promise<any[]> {
      try {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

        if (isLocalFirst) {
          const { OfflineAuthService } = await import('./OfflineAuthService');
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams({ store_id: storeId });
            if (from) params.append('date_from', from.toISOString());
            const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/cash_transactions?${params.toString()}`, { headers });
            if (res.ok) return await res.json();
            throw new Error('Bridge unreachable');
          }
        }

        return [];
      } catch (error) {
        console.error('getCashTransactions error:', error);
        return [];
      }
    }

    async createCashTransaction(data: any): Promise<boolean> {
      try {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

        if (isLocalFirst) {
          const { OfflineAuthService } = await import('./OfflineAuthService');
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/cash_transactions`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            return res.ok;
          }
        }

        return false;
      } catch (error) {
        console.error('createCashTransaction error:', error);
        return false;
      }
    }
}

export const OfflineDataService = new OfflineDataServiceClass();
