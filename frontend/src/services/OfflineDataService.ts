/**
 * OfflineDataService - Unified data access layer for offline-first architecture
 * Reads from LocalDatabase/Zustand stores first, syncs from Supabase when online
 */

import { LocalDatabase } from './LocalDatabase';
import { useMasterDataStore, ProductMaster, Supplier } from '@/stores/useMasterDataStore';
import { supabase } from '@/integrations/supabase/client';

export interface SaleWithItems {
  id: string;
  store_id: string;
  worker_id?: string;
  total_price: number;
  payment_method: string;
  sale_type: string;
  customer_name?: string;
  customer_phone?: string;
  invoice_number?: string;
  payment_status?: string;
  amount_paid?: number;
  created_at: string;
  synced: boolean;
  sale_items: SaleItem[];
}

export interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  date: string;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  supplier_name: string;
  amount: number;
  date: string;
}

class OfflineDataServiceClass {
  /**
   * Get sales with items - prioritizes local data, falls back to Supabase when online
   */
  async getSales(storeId: string, dateFrom?: Date, dateTo?: Date): Promise<SaleWithItems[]> {
    // First, get local sales
    await LocalDatabase.init();
    const localSales = await LocalDatabase.getSales(storeId);

    // Transform local sales to SaleWithItems format
    let sales: SaleWithItems[] = localSales.map(sale => ({
      id: sale.id,
      store_id: sale.store_id || storeId,
      worker_id: sale.worker_id,
      total_price: sale.total_price,
      payment_method: sale.payment_method,
      sale_type: sale.sale_type,
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      invoice_number: (sale as any).invoice_number,
      payment_status: (sale as any).payment_status || (sale.payment_method === 'credit' ? 'pending' : 'paid'),
      amount_paid: (sale as any).amount_paid,
      created_at: sale.created_at,
      synced: sale.synced,
      sale_items: (sale.items || []).map((item: any, idx: number) => ({
        id: item.id || `item-${idx}`,
        product_name: item.product_name || item.name,
        quantity: item.quantity,
        unit_price: item.unit_price || item.price,
        total: item.total || (item.quantity * (item.unit_price || item.price)),
      })),
    }));

    // If online, try to fetch and merge remote sales
    if (navigator.onLine) {
      try {
        let query = supabase
          .from('sales')
          .select('*, sale_items(*)')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false });

        if (dateFrom) {
          query = query.gte('created_at', dateFrom.toISOString());
        }
        if (dateTo) {
          query = query.lte('created_at', dateTo.toISOString());
        }

        const { data: remoteSales } = await query;

        if (remoteSales) {
          // Merge: add remote sales that don't exist locally
          const localIds = new Set(sales.map(s => s.id));
          for (const rs of remoteSales as any[]) {
            if (!localIds.has(rs.id)) {
              sales.push({
                id: rs.id,
                store_id: rs.store_id,
                worker_id: rs.worker_id,
                total_price: rs.total_price,
                payment_method: rs.payment_method,
                sale_type: rs.sale_type,
                customer_name: rs.customer_name,
                customer_phone: rs.customer_phone,
                invoice_number: rs.invoice_number,
                payment_status: rs.payment_status,
                amount_paid: rs.amount_paid,
                created_at: rs.created_at,
                synced: true,
                sale_items: (rs.sale_items || []).map((item: any) => ({
                  id: item.id,
                  product_name: item.product_name,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  total: item.total,
                })),
              });

              // Cache to local DB for offline access
              await LocalDatabase.saveSale({
                id: rs.id,
                store_id: rs.store_id,
                worker_id: rs.worker_id,
                items: rs.sale_items || [],
                total_price: rs.total_price,
                payment_method: rs.payment_method,
                sale_type: rs.sale_type,
                customer_name: rs.customer_name,
                customer_phone: rs.customer_phone,
                created_at: rs.created_at,
                synced: true,
              });
            }
          }
        }
      } catch (error) {
        console.log('Failed to fetch remote sales, using local only:', error);
      }
    }

    // Filter by date range if provided
    if (dateFrom || dateTo) {
      sales = sales.filter(sale => {
        const saleDate = new Date(sale.created_at);
        if (dateFrom && saleDate < dateFrom) return false;
        if (dateTo && saleDate > dateTo) return false;
        return true;
      });
    }

    // Sort by date descending
    return sales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Get products from Zustand store (already cached locally)
   */
  getProducts(storeId: string): ProductMaster[] {
    const store = useMasterDataStore.getState();
    return store.products.filter(p => p.store_id === storeId);
  }

  /**
   * Get suppliers from Zustand store
   */
  getSuppliers(storeId: string): Supplier[] {
    const store = useMasterDataStore.getState();
    return store.suppliers.filter(s => s.store_id === storeId);
  }

  /**
   * Get stock movements - generates from local sales if no dedicated storage
   * Falls back to message if history not available offline
   */
  async getStockMovements(storeId: string): Promise<{ movements: StockMovement[]; offlineMessage?: string }> {
    const dataClient = (await import('@/lib/dataClient')).getDataClient();
    if (dataClient.isLocalFirst) {
      try {
        const { OfflineAuthService } = await import('./OfflineAuthService');
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const params = new URLSearchParams({ store_id: storeId });
          const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/inventory_movements?${params.toString()}`, {
            headers,
          });
          if (response.ok) {
            const payload = await response.json().catch(() => []);
            const movements = (payload || []).map((row: any) => ({
              id: row.id,
              product_id: row.product_id,
              product_name: row.product_name || row.product_id,
              type: row.movement_type as 'in' | 'out' | 'adjustment',
              quantity: row.quantity,
              reason: row.reason || undefined,
              date: row.created_at,
            })) as StockMovement[];
            return { movements };
          }
        }
      } catch {
        // fall through to derived movements
      }
    }

    // Generate movements from local sales
    const sales = await this.getSales(storeId);
    const movements: StockMovement[] = [];

    sales.forEach((sale) => {
      sale.sale_items.forEach((item, itemIdx) => {
        movements.push({
          id: `mov-sale-${sale.id}-${itemIdx}`,
          product_id: '',
          product_name: item.product_name,
          type: 'out',
          quantity: item.quantity,
          reason: `Vente ${sale.invoice_number || sale.id.slice(0, 8)}`,
          date: sale.created_at,
        });
      });
    });

    if (!navigator.onLine && movements.length === 0) {
      return {
        movements: [],
        offlineMessage: 'Historique complet disponible uniquement en ligne. Affichage des mouvements récents.',
      };
    }

    return { movements: movements.slice(0, 50) };
  }

  /**
   * Get supplier payments from local data or Supabase
   */
  async getSupplierPayments(storeId: string, dateFrom?: Date): Promise<SupplierPayment[]> {
    if (!navigator.onLine) {
      // Return empty with graceful message - supplier payments aren't cached locally yet
      return [];
    }

    try {
      // Cast as any - supplier_payments table may not be in types yet
      let query = (supabase as any)
        .from('supplier_payments')
        .select('*, supplier:suppliers(name)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (dateFrom) {
        query = query.gte('created_at', dateFrom.toISOString());
      }

      const { data } = await query;

      return ((data as any[]) || []).map(p => ({
        id: p.id,
        supplier_id: p.supplier_id,
        supplier_name: p.supplier?.name || 'Unknown',
        amount: p.amount,
        date: p.created_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Update product stock locally and queue for sync
   */
  async updateProductStock(productId: string, newQuantity: number, reason?: string): Promise<boolean> {
    const store = useMasterDataStore.getState();
    const product = store.products.find((p) => p.id === productId);
    if (!product) return false;

    const prevQuantity = product.current_stock ?? 0;
    const delta = newQuantity - prevQuantity;
    const now = new Date().toISOString();

    // Update in Zustand store
    store.updateProduct(productId, {
      current_stock: newQuantity,
      updated_at: now,
    });

    await LocalDatabase.init();

    const dataClient = (await import('@/lib/dataClient')).getDataClient();
    if (dataClient.isLocalFirst) {
      try {
        const { OfflineAuthService } = await import('./OfflineAuthService');
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const movementType = delta > 0 ? 'in' : delta < 0 ? 'out' : 'adjustment';
          if (movementType !== 'adjustment') {
            await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/inventory_movements`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({
                store_id: product.store_id,
                product_id: productId,
                product_name: product.name,
                movement_type: movementType,
                quantity: Math.abs(delta),
                reason: reason ?? null,
                source: 'stock_adjustment',
              }),
            });
          }
          await LocalDatabase.addToSyncQueue({
            id: crypto.randomUUID(),
            type: 'pending_mutation',
            data: {
              supabase_service_key: '',
              entity: 'inventory_movements',
              payload: {
                id: crypto.randomUUID(),
                store_id: product.store_id,
                product_id: productId,
                product_name: product.name,
                movement_type: movementType,
                quantity: Math.abs(delta),
                reason: reason ?? null,
                source: 'stock_adjustment',
                created_at: now,
              },
            },
            timestamp: Date.now(),
            retries: 0,
          });
          await LocalDatabase.addToSyncQueue({
            id: crypto.randomUUID(),
            type: 'inventory_update',
            data: {
              id: productId,
              store_id: product.store_id,
              product_name: product.name,
              sku: product.sku,
              quantity: newQuantity,
              unit_price: product.selling_price_detail || 0,
            },
            timestamp: Date.now(),
            retries: 0,
          });
          return true;
        }
      } catch (error) {
        console.log('Failed to write LocalBridge movement, queued locally:', error);
      }
    }

    await LocalDatabase.addToSyncQueue({
      id: crypto.randomUUID(),
      type: 'inventory_update',
      data: {
        id: productId,
        store_id: product.store_id,
        product_name: product.name,
        sku: product.sku,
        quantity: newQuantity,
        unit_price: product.selling_price_detail || 0,
      },
      timestamp: Date.now(),
      retries: 0,
    });

    // If online, also update immediately
    if (navigator.onLine) {
      try {
        await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', productId);
      } catch (error) {
        console.log('Failed to sync product update, queued for later:', error);
      }
    }

    return true;
  }

  /**
   * Initial sync - fetches all master data from Supabase and caches locally
   * Call this when app starts or user requests sync
   */
  async performInitialSync(storeId: string): Promise<{ success: boolean; message: string }> {
    if (!navigator.onLine) {
      return { success: false, message: 'Connexion internet requise pour la synchronisation' };
    }

    const store = useMasterDataStore.getState();
    store.setLoading(true);

    try {
      // Fetch products - Disabled to prevent memory bloat. Using server-side search instead.
      /*
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true);

      if (products) {
        store.setProducts((products as any[]).map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          description: p.description,
          purchase_price: p.cost_price,
          selling_price_detail: p.unit_price,
          selling_price_wholesale: p.wholesale_price,
          min_stock_alert: p.min_quantity,
          current_stock: p.quantity,
          unit_type: p.unit_type,
          family_id: p.category,
          expiry_date: p.expiry_date,
          store_id: p.store_id,
          image_url: p.image_url,
          created_at: p.created_at,
          updated_at: p.updated_at,
        })));
      }
      */

      // Fetch suppliers - cast as any since table may not be in types yet
      const { data: suppliers } = await (supabase as any)
        .from('suppliers')
        .select('*')
        .eq('store_id', storeId);

      if (suppliers) {
        store.setSuppliers((suppliers as any[]).map(s => ({
          id: s.id,
          name: s.name,
          contact_person: s.contact_person,
          phone: s.phone,
          email: s.email,
          address: s.address,
          balance: s.balance || 0,
          store_id: s.store_id,
          created_at: s.created_at,
          updated_at: s.updated_at,
        })));
      }

      // Fetch recent sales and cache them
      const { data: sales } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (sales) {
        for (const sale of sales as any[]) {
          await LocalDatabase.saveSale({
            id: sale.id,
            store_id: sale.store_id,
            worker_id: sale.worker_id,
            items: sale.sale_items || [],
            total_price: sale.total_price,
            payment_method: sale.payment_method,
            sale_type: sale.sale_type,
            customer_name: sale.customer_name,
            customer_phone: sale.customer_phone,
            created_at: sale.created_at,
            synced: true,
          });
        }
      }

      store.setLastSync(new Date().toISOString());
      store.setLoading(false);

      return { success: true, message: `Synchronisation terminée: ${products?.length || 0} produits, ${sales?.length || 0} ventes` };
    } catch (error) {
      store.setLoading(false);
      console.error('Initial sync error:', error);
      return { success: false, message: 'Erreur lors de la synchronisation' };
    }
  }

  /**
   * Check if data is available locally
   */
  hasLocalData(storeId: string): boolean {
    const store = useMasterDataStore.getState();
    return store.products.filter(p => p.store_id === storeId).length > 0;
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTime(): string | null {
    return useMasterDataStore.getState().lastSync;
  }

  /**
   * Get aggregated dashboard analytics from LocalBridge
   */
  async getDashboardAnalytics(storeId: string): Promise<{
    daily_revenue: number;
    weekly_revenue: { date: string; revenue: number }[];
    top_products: { name: string; quantity: number; revenue: number }[];
    top_workers: { name: string; sales_count: number; revenue: number }[];
  } | null> {
    const dataClient = (await import('@/lib/dataClient')).getDataClient();
    if (dataClient.isLocalFirst) {
      try {
        const { OfflineAuthService } = await import('./OfflineAuthService');
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const params = new URLSearchParams({ store_id: storeId });
          const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/analytics/dashboard?${params.toString()}`, {
            headers,
          });
          if (response.ok) {
            return await response.json();
          }
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
    }
    return null;
  }

  /**
   * Get stock valuation
   */
  async getStockValuation(storeId: string): Promise<{ total_cost: number; total_retail: number; item_count: number } | null> {
    const dataClient = (await import('@/lib/dataClient')).getDataClient();
    if (dataClient.isLocalFirst) {
      try {
        const { OfflineAuthService } = await import('./OfflineAuthService');
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const params = new URLSearchParams({ store_id: storeId });
          const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/analytics/stock-valuation?${params.toString()}`, {
            headers,
          });
          if (response.ok) {
            return await response.json();
          }
        }
      } catch (error) {
        console.error('Failed to fetch valuation:', error);
      }
    }
    return null;
  }
}

export const OfflineDataService = new OfflineDataServiceClass();
