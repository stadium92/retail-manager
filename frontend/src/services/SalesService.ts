import { supabase } from '@/integrations/supabase/client';
import { Sale, SaleWithDetails, SaleItem, SaleType, PaymentStatus } from '@/types';
import { saleSchema, saleUpdateSchema } from '@/schemas/validation';
import { OfflineSalesService } from './OfflineSalesService';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';

// Helper to map DB response to typed Sale
const mapToSale = (data: any): Sale => ({
  ...data,
  sale_type: data.sale_type as SaleType,
  payment_status: data.payment_status as PaymentStatus,
});

export class SalesService {
  static async getSales(storeId?: string, limit?: number): Promise<{ data?: SaleWithDetails[]; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const localSales = await OfflineSalesService.getSales(storeId);
        const salesWithDetails: SaleWithDetails[] = (localSales || []).map((sale, index) => ({
          id: sale.id,
          store_id: sale.store_id,
          worker_id: sale.worker_id,
          customer_name: sale.customer_name,
          customer_phone: sale.customer_phone,
          sale_type: sale.sale_type as SaleType,
          total_price: Number(sale.total_price),
          payment_method: sale.payment_method,
          payment_status: 'paid',
          created_at: sale.created_at,
          updated_at: sale.created_at,
          items: (sale.items || []).map((item: any, idx: number) => ({
            id: `${sale.id}-${idx}`,
            sale_id: sale.id,
            product_id: item.product?.id || item.product_id,
            product_name: item.product?.name || item.product_name || 'Item',
            quantity: item.quantity || 0,
            unit_price: item.product?.unit_price || item.unit_price || 0,
            discount: item.discount || 0,
            total: item.total ?? (item.quantity || 0) * (item.unit_price || 0),
            created_at: sale.created_at,
          })),
          worker: undefined,
          store: undefined,
        }));
        const limited = limit ? salesWithDetails.slice(0, limit) : salesWithDetails;
        return { data: limited };
      }

      let query = supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data: sales, error } = await query;

      if (error) return { error };

      // Fetch related data separately
      const salesWithDetails: SaleWithDetails[] = await Promise.all(
        (sales || []).map(async (sale) => {
          const [itemsRes, workerRes, storeRes] = await Promise.all([
            supabase.from('sale_items').select('*').eq('sale_id', sale.id),
            sale.worker_id
              ? supabase.from('profiles').select('*').eq('id', sale.worker_id).maybeSingle()
              : Promise.resolve({ data: null }),
            supabase.from('stores').select('*').eq('id', sale.store_id).single(),
          ]);

          return {
            ...mapToSale(sale),
            items: itemsRes.data || [],
            worker: workerRes.data || undefined,
            store: storeRes.data || undefined,
          };
        })
      );

      return { data: salesWithDetails, error };
    } catch (error) {
      return { error };
    }
  }

  static async getSale(id: string): Promise<{ data?: SaleWithDetails; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const localSales = await OfflineSalesService.getSales();
        const sale = (localSales || []).find((s) => s.id === id);
        if (!sale) return { error: { message: 'Sale not found locally.' } };
        const mapped: SaleWithDetails = {
          id: sale.id,
          store_id: sale.store_id,
          worker_id: sale.worker_id,
          customer_name: sale.customer_name,
          customer_phone: sale.customer_phone,
          sale_type: sale.sale_type as SaleType,
          total_price: Number(sale.total_price),
          payment_method: sale.payment_method,
          payment_status: 'paid',
          created_at: sale.created_at,
          updated_at: sale.created_at,
          items: (sale.items || []).map((item: any, idx: number) => ({
            id: `${sale.id}-${idx}`,
            sale_id: sale.id,
            product_id: item.product?.id || item.product_id,
            product_name: item.product?.name || item.product_name || 'Item',
            quantity: item.quantity || 0,
            unit_price: item.product?.unit_price || item.unit_price || 0,
            discount: item.discount || 0,
            total: item.total ?? (item.quantity || 0) * (item.unit_price || 0),
            created_at: sale.created_at,
          })),
          worker: undefined,
          store: undefined,
        };
        return { data: mapped };
      }

      const { data: sale, error } = await supabase
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return { error };

      // Fetch related data
      const [itemsRes, workerRes, storeRes] = await Promise.all([
        supabase.from('sale_items').select('*').eq('sale_id', sale.id),
        sale.worker_id
          ? supabase.from('profiles').select('*').eq('id', sale.worker_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('stores').select('*').eq('id', sale.store_id).single(),
      ]);

      const saleWithDetails: SaleWithDetails = {
        ...mapToSale(sale),
        items: itemsRes.data || [],
        worker: workerRes.data || undefined,
        store: storeRes.data || undefined,
      };

      return { data: saleWithDetails, error };
    } catch (error) {
      return { error };
    }
  }

  static async createSale(sale: Omit<Sale, 'id' | 'created_at' | 'updated_at'>): Promise<{ data?: Sale; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const result = await OfflineSalesService.createSale({
          store_id: sale.store_id,
          worker_id: sale.worker_id!,
          items: [],
          total_price: Number(sale.total_price),
          sale_type: (sale.sale_type || 'detail') as any,
          payment_method: (sale.payment_method || 'cash') as any,
          customer_name: sale.customer_name || undefined,
          customer_phone: sale.customer_phone || undefined,
        });
        return { data: result.data as any, error: result.error };
      }

      // Validate input
      const validationResult = saleSchema.safeParse(sale);
      if (!validationResult.success) {
        return { error: { message: validationResult.error.errors[0].message } };
      }

      // Use Offline Service
      const result = await OfflineSalesService.createSale({
        store_id: sale.store_id,
        worker_id: sale.worker_id!,
        items: [],
        total_price: Number(sale.total_price),
        sale_type: sale.sale_type as any,
        payment_method: sale.payment_method as any,
        customer_name: sale.customer_name || undefined,
        customer_phone: sale.customer_phone || undefined,
      });

      return { data: result.data as any, error: result.error };
    } catch (error) {
      return { error };
    }
  }

  static async createSaleWithItems(
    sale: Omit<Sale, 'id' | 'created_at' | 'updated_at'>,
    items: Omit<SaleItem, 'id' | 'sale_id' | 'created_at'>[]
  ): Promise<{ data?: Sale; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const cartItems: any[] = items.map(item => ({
          product: { id: item.product_id, name: item.product_name, unit_price: item.unit_price },
          quantity: item.quantity,
          total: item.total,
          discount: item.discount || 0
        }));
        const result = await OfflineSalesService.createSale({
          store_id: sale.store_id,
          worker_id: sale.worker_id!,
          items: cartItems,
          total_price: Number(sale.total_price),
          sale_type: (sale.sale_type || 'detail') as any,
          payment_method: (sale.payment_method || 'cash') as any,
          customer_name: sale.customer_name || undefined,
          customer_phone: sale.customer_phone || undefined,
        });
        return { data: result.data as any, error: result.error };
      }

      // Map SaleItem[] back to CartItem[] structure for OfflineService
      // Note: This requires products to be fully populated, but SaleItem only has IDs.
      // However, for POS usage, we likely have the full product data available in the context calling this.
      // If this method is called from legacy code without full product objects, this might be tricky.
      // BUT: The plan is to call OfflineSalesService directly from the POS frontend.
      // This refactor is to ensure legacy calls also go through offline logic if possible.

      // Let's create a partial mapper
      const cartItems: any[] = items.map(item => ({
        product: { id: item.product_id, name: item.product_name, unit_price: item.unit_price },
        quantity: item.quantity,
        total: item.total,
        discount: item.discount || 0
      }));

      const result = await OfflineSalesService.createSale({
        store_id: sale.store_id,
        worker_id: sale.worker_id!,
        items: cartItems,
        total_price: Number(sale.total_price),
        sale_type: sale.sale_type as any,
        payment_method: sale.payment_method as any,
        customer_name: sale.customer_name || undefined,
        customer_phone: sale.customer_phone || undefined
      });

      return { data: result.data as any, error: result.error };
    } catch (error) {
      return { error };
    }
  }

  static async updateSale(id: string, updates: Partial<Sale>): Promise<{ data?: Sale; error?: any }> {
    try {
      // Validate input
      const validationResult = saleUpdateSchema.safeParse(updates);
      if (!validationResult.success) {
        return { error: { message: validationResult.error.errors[0].message } };
      }

      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'Local session required.' } };
        }
        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/sales/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(validationResult.data),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return { data: payload };
      }

      const { data, error } = await supabase
        .from('sales')
        .update(validationResult.data as any)
        .eq('id', id)
        .select()
        .single();

      return { data: data ? mapToSale(data) : undefined, error };
    } catch (error) {
      return { error };
    }
  }

  static async deleteSale(id: string): Promise<{ error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'Local session required.' } };
        }
        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/sales/${id}`, {
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
      // Date Calculation Helper
      const now = new Date();

      // Start of Today (00:00:00 Local)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Start of "Last 7 Days" (00:00:00 Local, 7 days ago)
      // This implies an 8-day window including today, or strictly last 7 days? 
      // Usually "Week" stats in dashboards are "Last 7 Days" meaning [Today-6, Today].
      // The previous logic was `now - 7 days`, creating a sliding window.
      // We'll use start of day 7 days ago to encompass the full days.
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

      // Start of Month (00:00:00 Local, 1st of month)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const dataClient = getDataClient();

      if (dataClient.isLocalFirst) {
        const sales = await OfflineSalesService.getSales(storeId);

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
      }

      // Supabase / Online Logic
      // We use todayStart.toISOString() to query the DB in UTC correctly relative to the user's local midnight.

      const [todayRes, weekRes, monthRes] = await Promise.all([
        SalesService.fetchSum(todayStart.toISOString(), storeId),
        SalesService.fetchSum(weekStart.toISOString(), storeId),
        SalesService.fetchSum(monthStart.toISOString(), storeId)
      ]);

      return {
        todaySales: todayRes.sum,
        weekSales: weekRes.sum,
        monthSales: monthRes.sum,
        error: todayRes.error || weekRes.error || monthRes.error
      };
    } catch (error) {
      console.error('Error calculating sales metrics:', error);
      return { todaySales: 0, weekSales: 0, monthSales: 0, error };
    }
  }

  // Helper for fetching sums efficiently
  private static async fetchSum(fromDateISO: string, storeId?: string): Promise<{ sum: number, error?: any }> {
    let query = supabase.from('sales').select('total_price').gte('created_at', fromDateISO);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;
    const sum = data?.reduce((acc, sale) => acc + Number(sale.total_price), 0) || 0;

    return { sum, error };
  }
}
