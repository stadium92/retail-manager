import { create } from 'zustand';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useMasterDataStore } from './useMasterDataStore';
import { LocalDatabase } from '@/services/LocalDatabase';

export interface Supplier {
  id: string;
  store_id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  default_purchase_type?: string;
}

export interface PurchaseOrder {
  id: string;
  store_id: string;
  supplier_id: string;
  status: 'draft' | 'ordered' | 'received' | 'partial';
  total_amount: number;
  notes?: string;
  order_number?: string;
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
  product?: { id: string; name: string; quantity: number; min_quantity: number; cost_price: number; packaging: string; unit_type?: string };
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
  synced: boolean;
}

interface PurchasingState {
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  orderItems: PurchaseItem[];
  cart: { product_id: string; quantity: number; cost_price: number }[];
  loading: boolean;
  
  fetchSuppliers: (storeId: string) => Promise<void>;
  fetchOrders: (storeId: string, status?: string) => Promise<void>;
  fetchOrderItems: (orderId: string) => Promise<void>;
  clearOrderItems: () => void;
  
  createOrder: (order: Partial<PurchaseOrder>, items: any[]) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  receiveOrder: (orderId: string, items: { id: string; quantity_received: number; unit_cost: number }[]) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  
  addSupplier: (supplier: Partial<Supplier>) => Promise<Supplier | null>;
  addPayment: (payment: Partial<SupplierPayment>) => Promise<void>;
  
  addToCart: (productId: string, quantity: number, costPrice: number) => void;
  updateCartItem: (productId: string, updates: Partial<{ quantity: number; cost_price: number }>) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
}

export const usePurchasingStore = create<PurchasingState>((set, get) => ({
  suppliers: [],
  orders: [],
  orderItems: [],
  cart: [],
  loading: false,

  fetchSuppliers: async (storeId) => {
    if (!storeId) return;
    try {
      await LocalDatabase.init();
      const local = await LocalDatabase.getSuppliers(storeId);
      if (local.length > 0) set({ suppliers: local as any, loading: false });
      else set({ loading: true });

      const dc = getDataClient();
      let remote: any[] = [];
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/suppliers?store_id=${storeId}`, { headers });
          if (res.ok) remote = await res.json();
        }
      } else if (navigator.onLine) {
        // No remote client available; rely on local cache
      }

      if (remote.length > 0) {
        for (const s of remote) await LocalDatabase.saveSupplier({ ...s, synced: true });
        set({ suppliers: remote, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (e) {
      set({ loading: false });
    }
  },

  fetchOrders: async (storeId, status) => {
    if (!storeId) return;
    try {
      await LocalDatabase.init();
      const local = await LocalDatabase.getPurchaseOrders(storeId);
      if (local.length > 0) {
        set({ 
          orders: local.map(o => ({ ...o, supplier: { name: o.supplier_name || '?' } })) as any,
          loading: false 
        });
      } else set({ loading: true });

      const dc = getDataClient();
      let remote: any[] = [];
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders?store_id=${storeId}`, { headers });
          if (res.ok) remote = await res.json();
        }
      } else if (navigator.onLine) {
        // No remote client available; rely on local cache
      }

      if (remote.length > 0) {
        for (const o of remote) {
          await LocalDatabase.savePurchaseOrder({
            id: o.id, store_id: o.store_id, supplier_id: o.supplier_id,
            status: o.status, total_amount: o.total_amount, notes: o.notes,
            created_at: o.created_at, updated_at: o.updated_at, synced: true,
            supplier_name: o.supplier?.name
          });
        }
        set({ orders: remote, loading: false });
      } else set({ loading: false });
    } catch (e) {
      set({ loading: false });
    }
  },

  fetchOrderItems: async (orderId) => {
    const dc = getDataClient();
    try {
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_items?order_id=${orderId}`, { headers });
          if (res.ok) {
            const data = await res.json();
            set({ orderItems: data });
            return;
          }
        }
      }
      const { data } = { data: null as any };
      if (data) set({ orderItems: data });
    } catch (e) {}
  },

  clearOrderItems: () => set({ orderItems: [] }),

  createOrder: async (order, items) => {
    const orderId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const localOrder = { ...order, id: orderId, created_at: timestamp, updated_at: timestamp, synced: false };
    
    await LocalDatabase.init();
    await LocalDatabase.savePurchaseOrder(localOrder as any);
    set(state => ({ orders: [localOrder as any, ...state.orders] }));

    const dc = getDataClient();
    try {
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...localOrder, items })
          });
        }
      } else {
        // No remote client available; order saved locally only
      }
    } catch (e) {}
  },

  updateOrderStatus: async (orderId, status) => {
    const dc = getDataClient();
    try {
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders/${orderId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
          });
        }
      } else {
        // No remote client available
      }
      set(state => ({ orders: state.orders.map(o => o.id === orderId ? { ...o, status: status as any } : o) }));
    } catch (e) {}
  },

  receiveOrder: async (orderId, items) => {
    const dc = getDataClient();
    try {
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders/${orderId}/receive`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
        }
      } else {
        // Complex Supabase logic removed; receive only via local bridge
      }
      set(state => ({ orders: state.orders.map(o => o.id === orderId ? { ...o, status: 'received' } : o) }));
    } catch (e) {}
  },

  deleteOrder: async (orderId) => {
    try {
      console.log('[PurchasingStore] Deleting order:', orderId);
      await LocalDatabase.init();
      await LocalDatabase.deletePurchaseOrder(orderId);
      set(state => ({ orders: state.orders.filter(o => o.id !== orderId) }));

      const dc = getDataClient();
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders/${orderId}`, {
            method: 'DELETE',
            headers
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error('[PurchasingStore] Backend delete failed:', res.status, errData);
            throw new Error(errData.message || `Server error: ${res.status}`);
          }
        }
      } else {
        // No remote client available; deleted locally
      }
      console.log('[PurchasingStore] Order deleted successfully');
    } catch (e: any) {
      console.error('[PurchasingStore] deleteOrder failed:', e);
      throw e;
    }
  },

  addSupplier: async (supplier) => {
    const dc = getDataClient();
    try {
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/suppliers`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(supplier)
          });
          if (res.ok) {
            const data = await res.json();
            set(state => ({ suppliers: [...state.suppliers, data] }));
            return data;
          }
        }
      }
      const { data } = { data: null as any };
      if (data) {
        set(state => ({ suppliers: [...state.suppliers, data] }));
        return data;
      }
    } catch (e) {}
    return null;
  },

  addPayment: async (payment) => {
    const dc = getDataClient();
    try {
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          await fetch(`${dc.localBridgeBaseUrl}/rest/v1/supplier_payments`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(payment)
          });
        }
      } else {
        // No remote client available
      }
    } catch (e) {}
  },

  addToCart: (productId, quantity, costPrice) => set(state => ({ cart: [...state.cart, { product_id: productId, quantity, cost_price: costPrice }] })),
  updateCartItem: (productId, updates) => set(state => ({ cart: state.cart.map(c => c.product_id === productId ? { ...c, ...updates } : c) })),
  removeFromCart: (productId) => set(state => ({ cart: state.cart.filter(c => c.product_id !== productId) })),
  clearCart: () => set({ cart: [] }),
}));
