import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';

export interface Supplier {
  id: string;
  store_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  store_id: string;
  supplier_id: string;
  status: 'draft' | 'ordered' | 'received' | 'partial';
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
}

export interface PurchaseItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  created_at: string;
  product?: { id: string; name: string; quantity: number; min_quantity: number; cost_price: number };
}

export interface SupplierPayment {
  id: string;
  store_id: string;
  supplier_id: string;
  amount: number;
  payment_method: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

interface PurchasingState {
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  currentOrder: PurchaseOrder | null;
  orderItems: PurchaseItem[];
  cart: CartItem[];
  loading: boolean;
  
  // Actions
  fetchSuppliers: (storeId: string) => Promise<void>;
  fetchOrders: (storeId: string, status?: string) => Promise<void>;
  fetchOrderItems: (orderId: string) => Promise<void>;
  
  addSupplier: (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => Promise<Supplier | null>;
  updateSupplierBalance: (supplierId: string, amount: number) => Promise<void>;
  
  createOrder: (order: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>, items: Omit<PurchaseItem, 'id' | 'created_at'>[]) => Promise<PurchaseOrder | null>;
  receiveOrder: (orderId: string, items: { id: string; quantity_received: number; unit_cost: number }[]) => Promise<void>;
  
  addPayment: (payment: Omit<SupplierPayment, 'id' | 'created_at'>) => Promise<void>;
  
  // Cart
  addToCart: (item: CartItem) => void;
  updateCartItem: (productId: string, updates: Partial<CartItem>) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  localBridgeRequest?: <T>(path: string, init?: RequestInit) => Promise<T>;
}

export const usePurchasingStore = create<PurchasingState>((set, get) => ({
  suppliers: [],
  orders: [],
  currentOrder: null,
  orderItems: [],
  cart: [],
  loading: false,

  // LocalBridge helper
  localBridgeRequest: async <T,>(path: string, init: RequestInit = {}) => {
    const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
    if (!isLocalFirst) {
      throw new Error('LocalBridge mode is not enabled.');
    }
    const headers = await OfflineAuthService.getAuthHeaders();
    if (!headers) {
      throw new Error('LocalBridge session expired. Please sign in again.');
    }

    const response = await fetch(`${localBridgeBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...headers,
      },
    });

    let payload: any = null;
    if (response.status !== 204) {
      try {
        payload = await response.json();
      } catch (error) {
        // ignore
      }
    }

    if (!response.ok) {
      const message = payload?.message || 'LocalBridge request failed';
      throw new Error(message);
    }

    return payload as T;
  },

  fetchSuppliers: async (storeId) => {
    set({ loading: true });
    const { isLocalFirst } = getDataClient();
    if (isLocalFirst) {
      try {
        const data = await (get() as any).localBridgeRequest(
          `/rest/v1/suppliers?${new URLSearchParams({ store_id: storeId }).toString()}`
        ) as Supplier[] | null;
        set({ suppliers: data || [], loading: false });
        return;
      } catch (error) {
        console.error('LocalBridge fetchSuppliers error:', error);
        set({ suppliers: [], loading: false });
        return;
      }
    }

    // Cast as any - suppliers table may not be in types yet
    const { data } = await (supabase as any)
      .from('suppliers')
      .select('*')
      .eq('store_id', storeId)
      .order('name');
    set({ suppliers: (data as Supplier[]) || [], loading: false });
  },

  fetchOrders: async (storeId, status) => {
    set({ loading: true });
    const { isLocalFirst } = getDataClient();
    if (isLocalFirst) {
      try {
        const params = new URLSearchParams({ store_id: storeId });
        if (status) params.set('status', status);
        const data = await (get() as any).localBridgeRequest(
          `/rest/v1/purchase_orders?${params.toString()}`
        ) as PurchaseOrder[] | null;
        set({ orders: data || [], loading: false });
        return;
      } catch (error) {
        console.error('LocalBridge fetchOrders error:', error);
        set({ orders: [], loading: false });
        return;
      }
    }

    // Cast as any - purchase_orders table may not be in types yet
    let query = (supabase as any)
      .from('purchase_orders')
      .select('*, supplier:suppliers(*)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data } = await query;
    set({ orders: (data as PurchaseOrder[]) || [], loading: false });
  },

  fetchOrderItems: async (orderId) => {
    const { isLocalFirst } = getDataClient();
    if (isLocalFirst) {
      try {
        const data = await (get() as any).localBridgeRequest(
          `/rest/v1/purchase_items?${new URLSearchParams({ order_id: orderId }).toString()}`
        ) as PurchaseItem[] | null;
        set({ orderItems: data || [] });
        return;
      } catch (error) {
        console.error('LocalBridge fetchOrderItems error:', error);
        set({ orderItems: [] });
        return;
      }
    }

    // Cast as any - purchase_items table may not be in types yet
    const { data } = await (supabase as any)
      .from('purchase_items')
      .select('*, product:products(id, name, quantity, min_quantity, cost_price)')
      .eq('order_id', orderId);
    set({ orderItems: (data as PurchaseItem[]) || [] });
  },

  addSupplier: async (supplier) => {
    const { isLocalFirst } = getDataClient();
    if (isLocalFirst) {
      try {
        const data = await (get() as any).localBridgeRequest(
          `/rest/v1/suppliers`,
          {
            method: 'POST',
            body: JSON.stringify(supplier),
          }
        ) as Supplier | null;
        if (data) {
          set((state) => ({ suppliers: [...state.suppliers, data] }));
          return data as Supplier;
        }
        return null;
      } catch (error) {
        console.error('LocalBridge addSupplier error:', error);
        return null;
      }
    }

    // Cast as any - suppliers table may not be in types yet
    const { data, error } = await (supabase as any)
      .from('suppliers')
      .insert(supplier)
      .select()
      .single();
    
    if (data && !error) {
      set((state) => ({ suppliers: [...state.suppliers, data as Supplier] }));
      return data as Supplier;
    }
    return null;
  },

  updateSupplierBalance: async (supplierId, amount) => {
    const supplier = get().suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const newBalance = supplier.balance + amount;
    const { isLocalFirst } = getDataClient();
    if (isLocalFirst) {
      try {
        await (get() as any).localBridgeRequest(`/rest/v1/suppliers/${supplierId}`, {
          method: 'PATCH',
          body: JSON.stringify({ balance: newBalance }),
        });
      } catch (error) {
        console.error('LocalBridge updateSupplierBalance error:', error);
      }
      set((state) => ({
        suppliers: state.suppliers.map(s =>
          s.id === supplierId ? { ...s, balance: newBalance } : s
        ),
      }));
      return;
    }

    // Cast as any - suppliers table may not be in types yet
    await (supabase as any)
      .from('suppliers')
      .update({ balance: newBalance })
      .eq('id', supplierId);
    
    set((state) => ({
      suppliers: state.suppliers.map(s => 
        s.id === supplierId ? { ...s, balance: newBalance } : s
      )
    }));
  },

  createOrder: async (order, items) => {
    const { isLocalFirst } = getDataClient();
    if (isLocalFirst) {
      try {
        const orderData = await (get() as any).localBridgeRequest(
          `/rest/v1/purchase_orders`,
          {
            method: 'POST',
            body: JSON.stringify(order),
          }
        ) as PurchaseOrder | null;

        if (orderData) {
          const itemsWithOrderId = items.map(item => ({
            ...item,
            order_id: orderData.id,
          }));

          for (const item of itemsWithOrderId) {
            await (get() as any).localBridgeRequest(`/rest/v1/purchase_items`, {
              method: 'POST',
              body: JSON.stringify(item),
            });
          }

          set((state) => ({ orders: [orderData as PurchaseOrder, ...state.orders] }));
          return orderData as PurchaseOrder;
        }
        return null;
      } catch (error) {
        console.error('LocalBridge createOrder error:', error);
        return null;
      }
    }

    // Cast as any - purchase_orders table may not be in types yet
    const { data: orderData, error } = await (supabase as any)
      .from('purchase_orders')
      .insert(order)
      .select()
      .single();
    
    if (orderData && !error) {
      const itemsWithOrderId = items.map(item => ({
        ...item,
        order_id: orderData.id
      }));
      
      // Cast as any - purchase_items table may not be in types yet
      await (supabase as any).from('purchase_items').insert(itemsWithOrderId);
      
      set((state) => ({ orders: [orderData as PurchaseOrder, ...state.orders] }));
      return orderData as PurchaseOrder;
    }
    return null;
  },

  receiveOrder: async (orderId, items) => {
    const { isLocalFirst } = getDataClient();
    if (isLocalFirst) {
      try {
        await (get() as any).localBridgeRequest(`/rest/v1/purchase_orders/${orderId}/receive`, {
          method: 'POST',
          body: JSON.stringify(items),
        });
        const updatedItems = await (get() as any).localBridgeRequest(
          `/rest/v1/purchase_items?${new URLSearchParams({ order_id: orderId }).toString()}`
        ) as PurchaseItem[] | null;
        const allReceived = (updatedItems || []).every(item => item.quantity_received >= item.quantity_ordered);
        const status: PurchaseOrder['status'] = allReceived ? 'received' : 'partial';
        set((state) => ({
          orders: state.orders.map(o => o.id === orderId ? { ...o, status } : o),
          orderItems: (updatedItems as PurchaseItem[]) || [],
        }));
      } catch (error) {
        console.error('LocalBridge receiveOrder error:', error);
      }
      return;
    }

    // Update each item's received quantity
    for (const item of items) {
      // Cast as any - purchase_items table may not be in types yet
      await (supabase as any)
        .from('purchase_items')
        .update({ quantity_received: item.quantity_received, unit_cost: item.unit_cost })
        .eq('id', item.id);
      
      // Update product stock and cost
      const orderItem = get().orderItems.find(oi => oi.id === item.id);
      if (orderItem?.product) {
        const newStock = orderItem.product.quantity + item.quantity_received;
        await supabase
          .from('products')
          .update({ quantity: newStock, cost_price: item.unit_cost })
          .eq('id', orderItem.product_id);
      }
    }
    
    // Check if fully or partially received
    const allItems = get().orderItems;
    const allReceived = allItems.every(item => {
      const update = items.find(i => i.id === item.id);
      return update ? update.quantity_received >= item.quantity_ordered : item.quantity_received >= item.quantity_ordered;
    });
    
    const status = allReceived ? 'received' : 'partial';
    // Cast as any - purchase_orders table may not be in types yet
    await (supabase as any).from('purchase_orders').update({ status }).eq('id', orderId);
    
    set((state) => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, status } : o)
    }));
  },

  addPayment: async (payment) => {
    const { isLocalFirst } = getDataClient();
    if (isLocalFirst) {
      try {
        await (get() as any).localBridgeRequest(`/rest/v1/supplier_payments`, {
          method: 'POST',
          body: JSON.stringify(payment),
        });
        await get().updateSupplierBalance(payment.supplier_id, -payment.amount);
      } catch (error) {
        console.error('LocalBridge addPayment error:', error);
      }
      return;
    }

    // Cast as any - supplier_payments table may not be in types yet
    await (supabase as any).from('supplier_payments').insert(payment);
    // Decrease supplier balance
    await get().updateSupplierBalance(payment.supplier_id, -payment.amount);
  },

  addToCart: (item) => {
    set((state) => {
      const existing = state.cart.find(c => c.product_id === item.product_id);
      if (existing) {
        return {
          cart: state.cart.map(c => 
            c.product_id === item.product_id 
              ? { ...c, quantity: c.quantity + item.quantity }
              : c
          )
        };
      }
      return { cart: [...state.cart, item] };
    });
  },

  updateCartItem: (productId, updates) => {
    set((state) => ({
      cart: state.cart.map(c => 
        c.product_id === productId ? { ...c, ...updates } : c
      )
    }));
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter(c => c.product_id !== productId)
    }));
  },

  clearCart: () => set({ cart: [] }),
}));
