import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
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
  synced?: boolean;
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
  synced?: boolean;
}

export interface PurchaseItem {
  id: string;
  order_id: string; // UNIFIED NAME
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  product?: { id: string; name: string; quantity: number; min_quantity: number; cost_price: number; packaging: string };
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
  storeSuppliers: Record<string, Supplier[]>;
  storeOrders: Record<string, PurchaseOrder[]>;
  orderItems: PurchaseItem[];
  cart: { product_id: string; quantity: number; cost_price: number }[];
  loading: boolean;
  loadingItems: boolean;
  
  fetchSuppliers: (storeId: string) => Promise<void>;
  fetchOrders: (storeId: string, status?: string) => Promise<void>;
  fetchOrderItems: (orderId: string) => Promise<void>;
  
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
  storeSuppliers: {},
  storeOrders: {},
  orderItems: [],
  cart: [],
  loading: false,
  loadingItems: false,

  fetchSuppliers: async (storeId) => {
    if (!storeId) return;
    set({ loading: true });
    try {
      await LocalDatabase.init();
      const dc = getDataClient();
      
      // BACKEND FIRST for Suppliers
      if (dc.isLocalFirst) {
        try {
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/suppliers?store_id=${storeId}`, { headers });
            if (res.ok) {
              const remote = await res.json();
              const local = await LocalDatabase.getSuppliers(storeId);
              const remoteIds = new Set(remote.map((s: any) => s.id));
              
              for (const l of local) {
                if (l.synced && !remoteIds.has(l.id)) await LocalDatabase.deleteSupplier(l.id);
              }
              for (const r of remote) {
                const lMatch = local.find(l => l.id === r.id);
                if (!lMatch || lMatch.synced) await LocalDatabase.saveSupplier({ ...r, synced: true });
              }
            }
          }
        } catch (e) {}
      }

      const updatedLocal = await LocalDatabase.getSuppliers(storeId);
      set(state => ({ 
        suppliers: updatedLocal as any,
        storeSuppliers: { ...state.storeSuppliers, [storeId]: updatedLocal as any }
      }));
    } catch (e) {
      console.error('fetchSuppliers error:', e);
    } finally {
      set({ loading: false });
    }
  },

  fetchOrders: async (storeId, status) => {
    if (!storeId) return;
    set({ loading: true });
    
    try {
      await LocalDatabase.init();
      const dc = getDataClient();

      // BACKEND FIRST for Orders
      if (dc.isLocalFirst) {
        try {
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const params = new URLSearchParams();
            params.set('store_id', storeId);
            if (status && status !== 'all') params.set('status', status);
            const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders?${params.toString()}`, { headers });
            
            if (res.ok) {
              const remote = await res.json();
              const local = await LocalDatabase.getPurchaseOrders(storeId);
              const remoteIds = new Set(remote.map((o: any) => o.id));
              
              // Safe delete: only if missing from backend AND matches current filter
              for (const l of local) {
                const statusMatch = !status || status === 'all' || l.status === status;
                if (l.synced && !remoteIds.has(l.id) && statusMatch) {
                  await LocalDatabase.deletePurchaseOrder(l.id);
                }
              }
              // Force update local DB with fresh backend data (authority)
              for (const r of remote) {
                const lMatch = local.find(l => l.id === r.id);
                if (!lMatch || lMatch.synced) {
                  await LocalDatabase.savePurchaseOrder({
                    id: r.id, store_id: r.store_id, supplier_id: r.supplier_id,
                    status: r.status, total_amount: r.total_amount, notes: r.notes,
                    created_at: r.created_at, updated_at: r.updated_at, synced: true,
                    supplier_name: r.supplier?.name
                  });
                }
              }
            }
          }
        } catch (e) {}
      }

      const updatedLocal = await LocalDatabase.getPurchaseOrders(storeId);
      let filteredUpdated = updatedLocal;
      if (status && status !== 'all') {
          filteredUpdated = updatedLocal.filter(o => o.status === status);
      }
      const mappedUpdated = filteredUpdated.map(o => ({ 
        ...o, 
        supplier: { name: (o as any).supplier_name || '?' } 
      }));
      
      set(state => ({ 
          orders: [...state.orders.filter(o => o.store_id !== storeId), ...mappedUpdated as any],
          storeOrders: { ...state.storeOrders, [storeId]: mappedUpdated as any }
      }));
    } catch (e) {
      console.error('fetchOrders error:', e);
    } finally {
      set({ loading: false });
    }
  },

  fetchOrderItems: async (orderId) => {
    if (!orderId) return;
    set({ orderItems: [], loadingItems: true });
    const dc = getDataClient();
    try {
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_items?order_id=${orderId}`, { headers });
          if (res.ok) {
            const data = await res.json();
            set({ orderItems: data, loadingItems: false });
            return;
          }
        }
      }
      const { data } = await (supabase as any)
        .from('purchase_items')
        .select('*, product:products(name, packaging)')
        .eq('order_id', orderId);
      
      if (data) set({ orderItems: data });
    } catch (e) {
      console.error('fetchOrderItems error:', e);
    } finally {
      set({ loadingItems: false });
    }
  },

  createOrder: async (order, items) => {
    const orderId = order.id || crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    let supplierName = '?';
    const storeSuppliersList = get().storeSuppliers[order.store_id!] || [];
    const supplier = storeSuppliersList.find(s => s.id === order.supplier_id);
    if (supplier) supplierName = supplier.name;

    const localOrder = { 
      ...order, 
      id: orderId, 
      created_at: timestamp, 
      updated_at: timestamp, 
      synced: false,
      supplier_name: supplierName 
    };
    
    await LocalDatabase.init();
    await LocalDatabase.savePurchaseOrder(localOrder as any);
    
    const mappedOrder = { ...localOrder, supplier: { name: supplierName } };
    
    set(state => ({ 
        orders: [mappedOrder as any, ...state.orders],
        storeOrders: {
            ...state.storeOrders,
            [order.store_id!]: [mappedOrder as any, ...(state.storeOrders[order.store_id!] || [])]
        }
    }));

    const dc = getDataClient();
    try {
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...localOrder, items: items.map(i => ({ ...i, order_id: orderId })) })
          });
          if (res.ok) {
            const remoteOrder = await res.json();
            if (remoteOrder) {
                await LocalDatabase.init();
                await LocalDatabase.savePurchaseOrder({ ...remoteOrder, synced: true } as any);
            }
          } else {
            console.error("Create Order Failed:", await res.text());
          }
        }
      } else {
        await supabase.from('purchase_orders').insert([localOrder]);
        await supabase.from('purchase_items').insert(items.map(i => ({ 
          ...i, 
          order_id: orderId 
        })));
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
        await supabase.from('purchase_orders').update({ status }).eq('id', orderId);
      }
      
      const mapper = (o: any) => o.id === orderId ? { ...o, status: status as any } : o;
      set(state => ({ 
          orders: state.orders.map(mapper),
          storeOrders: Object.keys(state.storeOrders).reduce((acc, sid) => ({
              ...acc,
              [sid]: (state.storeOrders[sid] || []).map(mapper)
          }), {})
      }));
    } catch (e) {}
  },

  receiveOrder: async (orderId, items) => {
    const dc = getDataClient();
    try {
      let isSuccess = false;
      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders/${orderId}/receive`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items.map(i => ({ ...i, order_id: orderId })) })
          });
          if (!res.ok) {
              const errText = await res.text();
              console.error("Receive Order Failed:", errText);
              throw new Error(errText);
          }
          const { order: updatedOrder, items: updatedItems } = await res.json();
          if (updatedOrder) {
            await LocalDatabase.init();
            await LocalDatabase.savePurchaseOrder({ ...updatedOrder, synced: true } as any);
            
            // CRITICAL FIX: If backend returned updated items, set them in state 
            // so the next fetch (triggered by event) pulls correct data
            if (updatedItems) {
                set({ orderItems: updatedItems });
            }
          }
          isSuccess = true;
        }
      } else {
        await supabase.rpc('receive_purchase_order', { p_order_id: orderId, p_items: items });
        isSuccess = true;
      }
      
      // CRITICAL: Filter out the received order from active lists immediately
      const filterOut = (o: PurchaseOrder) => o.id !== orderId;
      set(state => ({ 
          orders: state.orders.filter(filterOut),
          storeOrders: Object.keys(state.storeOrders).reduce((acc, sid) => ({
              ...acc,
              [sid]: (state.storeOrders[sid] || []).filter(filterOut)
          }), {})
      }));
    } catch (e) {}
  },

  deleteOrder: async (orderId) => {
    const dc = getDataClient();
    try {
      const filter = (o: any) => o.id !== orderId;
      set(state => ({ 
          orders: state.orders.filter(filter),
          storeOrders: Object.keys(state.storeOrders).reduce((acc, sid) => ({
              ...acc,
              [sid]: (state.storeOrders[sid] || []).filter(filter)
          }), {})
      }));

      await LocalDatabase.init();
      await LocalDatabase.deletePurchaseOrder(orderId);

      if (dc.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders/${orderId}`, {
            method: 'DELETE',
            headers: { ...headers }
          });
        }
      } else {
        await supabase.from('purchase_orders').delete().eq('id', orderId);
      }
    } catch (e) {
      console.error('deleteOrder error:', e);
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
            set(state => ({ 
                suppliers: [...state.suppliers, data],
                storeSuppliers: {
                    ...state.storeSuppliers,
                    [supplier.store_id!]: [...(state.storeSuppliers[supplier.store_id!] || []), data]
                }
            }));
            return data;
          }
        }
      }
      const { data } = await (supabase as any).from('suppliers').insert([supplier]).select().single();
      if (data) {
        set(state => ({ 
            suppliers: [...state.suppliers, data],
            storeSuppliers: {
                ...state.storeSuppliers,
                [supplier.store_id!]: [...(state.storeSuppliers[supplier.store_id!] || []), data]
            }
        }));
        return data;
      }
    } catch (e) {}
    return null;
  },

  addPayment: async (payment) => {
    const dc = getDataClient();
    try {
      const amount = payment.amount || 0;
      const supplierId = payment.supplier_id;
      
      const mapper = (s: Supplier) => s.id === supplierId ? { ...s, balance: Math.max(0, s.balance - amount) } : s;
      
      set(state => ({
        suppliers: state.suppliers.map(mapper),
        storeSuppliers: Object.keys(state.storeSuppliers).reduce((acc, sid) => ({
          ...acc,
          [sid]: (state.storeSuppliers[sid] || []).map(mapper)
        }), {})
      }));

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
        await supabase.from('supplier_payments').insert([payment]);
      }
    } catch (e) {}
  },

  addToCart: (productId, quantity, costPrice) => set(state => ({ cart: [...state.cart, { product_id: productId, quantity, cost_price: costPrice }] })),
  updateCartItem: (productId, updates) => set(state => ({ cart: state.cart.map(c => c.product_id === productId ? { ...c, ...updates } : c) })),
  removeFromCart: (productId) => set(state => ({ cart: state.cart.filter(c => c.product_id !== productId) })),
  clearCart: () => set({ cart: [] }),
}));
