import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/types';

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // Percentage 0-100
  unitPrice: number;
  lineTotal: number;
  total: number; // Alias for lineTotal for backward compatibility
}

export interface POSState {
  cart: CartItem[];
  pendingSaleId: string | null;
  activeRow: number;
  selectedRowIndex: number;
  isScanning: boolean;
  isCommandOpen: boolean;
  isPaymentModalOpen: boolean;
  searchQuery: string;
  saleType: 'detail' | 'gros';
  customerId?: string;
  customerName: string;
  customerPhone: string;

  // Actions
  addItem: (product: Product, quantity?: number) => void;
  addToCart: (product: Product | any, quantity?: number) => void; // Alias for compatibility
  updateQuantity: (indexOrId: number | string, quantity: number) => void;
  updateDiscount: (indexOrId: number | string, discount: number) => void;
  removeItem: (index: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setActiveRow: (index: number) => void;
  selectRow: (index: number) => void;
  selectNextRow: () => void;
  selectPreviousRow: () => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  setScanning: (isScanning: boolean) => void;
  setCustomer: (customerId?: string, name?: string, phone?: string) => void;
  setCommandOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSaleType: (type: 'detail' | 'gros') => void;
  setPaymentModalOpen: (open: boolean) => void;
  completeTransaction: (paymentMethod: string) => {
    id: string;
    items: CartItem[];
    grandTotal: number;
    customerName: string;
    customerPhone: string;
  } | null;
  /**
   * Confirms a transaction actually succeeded server-side - only NOW is
   * the cart cleared. completeTransaction() used to clear the cart itself,
   * synchronously, BEFORE the network call even started: if that call then
   * failed or timed out, the cart was already gone with no way to safely
   * retry the exact same sale, so a cashier re-ringing the same items from
   * scratch created a fully independent second sale (a new id, no DB error,
   * silently double-deducting stock - the "inventory drops by ~20/~40 with
   * no matching transaction" bug reports).
   */
  confirmTransaction: () => void;
  /**
   * For checkout flows that don't go through completeTransaction() (e.g.
   * a modal-based checkout that only clears the cart itself on success
   * already) - still gives them a stable id to submit with, so a manual
   * retry of the SAME still-populated cart hits the backend's idempotency
   * check instead of minting a new sale.
   */
  getOrCreatePendingSaleId: () => string;

  // Computed
  getTotal: () => number;
  subtotal: number;
  totalDiscount: number;
  grandTotal: number;
}

// Helper to calculate total with discount
function calculateItemTotal(price: number, quantity: number, discountPercent: number): number {
  const subtotal = price * quantity;
  const discountAmount = subtotal * (discountPercent / 100);
  return subtotal - discountAmount;
}

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      cart: [],
      pendingSaleId: null,
      activeRow: -1,
      selectedRowIndex: -1,
      isScanning: true,
      isCommandOpen: false,
      isPaymentModalOpen: false,
      searchQuery: '',
      saleType: 'detail',
      customerId: undefined,
      customerName: '',
      customerPhone: '',
      subtotal: 0,
      totalDiscount: 0,
      grandTotal: 0,

      addItem: (product, quantity = 1) => {
        const { cart, saleType } = get();
        
        // Check for specific preference: Some users want to merge, 
        // but based on request, we'll force a NEW line every time for clarity.
        // const existingItemIndex = cart.findIndex((item) => item.product.id === product.id);
        
        let price = product.unit_price || 0;
        if (saleType === 'gros') {
          price = product.wholesale_price || price;
        }

        // Logic for ALWAYS adding a new line (as requested by user "go to next line")
        const lineTotal = calculateItemTotal(price, quantity, 0);
        const newItem: CartItem = {
          product,
          quantity,
          discount: 0,
          unitPrice: price,
          lineTotal,
          total: lineTotal,
        };

        const newCart = [...cart, newItem];
        const subtotal = newCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const totalDiscount = newCart.reduce((sum, i) => sum + (i.unitPrice * i.quantity * i.discount / 100), 0);

        set({
          cart: newCart,
          activeRow: newCart.length - 1,
          selectedRowIndex: newCart.length - 1,
          subtotal,
          totalDiscount,
          grandTotal: subtotal - totalDiscount,
        });
      },

      // Alias for compatibility with different interfaces
      addToCart: (product, quantity = 1) => {
        // Map InventoryItem-like object to Product if needed
        const normalizedProduct: Product = {
          id: product.id,
          store_id: product.store_id,
          name: product.name,
          description: product.description,
          sku: product.sku,
          barcode: product.barcode,
          category: product.category || product.category_id,
          category_name: product.category_name ?? null,
          unit_price: product.unit_price ?? product.price ?? 0,
          wholesale_price: product.wholesale_price,
          cost_price: product.cost_price ?? product.cost,
          quantity: product.quantity,
          min_quantity: product.min_quantity ?? product.low_stock_threshold,
          image_url: product.image_url,
          is_active: product.is_active ?? true,
          expiry_date: product.expiry_date,
          created_at: product.created_at || new Date().toISOString(),
          updated_at: product.updated_at || new Date().toISOString(),
        };
        get().addItem(normalizedProduct, quantity);
      },

      setSaleType: (type) => {
        const { cart } = get();
        const newCart = cart.map(item => {
          let price = item.product.unit_price || 0;
          if (type === 'gros') {
            price = item.product.wholesale_price || price;
          }
          const newLineTotal = calculateItemTotal(price, item.quantity, item.discount);
          return {
            ...item,
            unitPrice: price,
            lineTotal: newLineTotal,
            total: newLineTotal,
          };
        });

        const subtotal = newCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const totalDiscount = newCart.reduce((sum, i) => sum + (i.unitPrice * i.quantity * i.discount / 100), 0);

        set({
          saleType: type,
          cart: newCart,
          subtotal,
          totalDiscount,
          grandTotal: subtotal - totalDiscount,
        });
      },

      updateQuantity: (indexOrId, quantity) => {
        const { cart } = get();
        let index = typeof indexOrId === 'number' ? indexOrId : cart.findIndex(i => i.product.id === indexOrId);
        if (index < 0 || index >= cart.length) return;

        const newCart = [...cart];
        const item = newCart[index];
        const price = item.unitPrice;

        if (quantity <= 0) {
          newCart.splice(index, 1);
          const subtotal = newCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
          const totalDiscount = newCart.reduce((sum, i) => sum + (i.unitPrice * i.quantity * i.discount / 100), 0);
          set({
            cart: newCart,
            activeRow: Math.min(index, Math.max(0, newCart.length - 1)),
            selectedRowIndex: Math.min(index, Math.max(0, newCart.length - 1)),
            subtotal,
            totalDiscount,
            grandTotal: subtotal - totalDiscount,
          });
        } else {
          const newLineTotal = calculateItemTotal(price, quantity, item.discount);
          newCart[index] = {
            ...item,
            quantity,
            lineTotal: newLineTotal,
            total: newLineTotal,
          };
          const subtotal = newCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
          const totalDiscount = newCart.reduce((sum, i) => sum + (i.unitPrice * i.quantity * i.discount / 100), 0);
          set({
            cart: newCart,
            subtotal,
            totalDiscount,
            grandTotal: subtotal - totalDiscount,
          });
        }
      },

      updateDiscount: (indexOrId, discount) => {
        const { cart } = get();
        let index = typeof indexOrId === 'number' ? indexOrId : cart.findIndex(i => i.product.id === indexOrId);
        if (index < 0 || index >= cart.length) return;

        const newCart = [...cart];
        const item = newCart[index];
        const price = item.unitPrice;
        const newLineTotal = calculateItemTotal(price, item.quantity, discount);

        newCart[index] = {
          ...item,
          discount,
          lineTotal: newLineTotal,
          total: newLineTotal,
        };
        const subtotal = newCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const totalDiscount = newCart.reduce((sum, i) => sum + (i.unitPrice * i.quantity * i.discount / 100), 0);
        set({
          cart: newCart,
          subtotal,
          totalDiscount,
          grandTotal: subtotal - totalDiscount,
        });
      },

      removeItem: (index) => {
        const { cart } = get();
        const newCart = [...cart];
        newCart.splice(index, 1);
        const subtotal = newCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const totalDiscount = newCart.reduce((sum, i) => sum + (i.unitPrice * i.quantity * i.discount / 100), 0);
        set({
          cart: newCart,
          activeRow: Math.min(index, newCart.length - 1),
          selectedRowIndex: Math.min(index, newCart.length - 1),
          subtotal,
          totalDiscount,
          grandTotal: subtotal - totalDiscount,
        });
      },

      removeFromCart: (productId) => {
        const { cart } = get();
        const index = cart.findIndex(i => i.product.id === productId);
        if (index >= 0) {
          get().removeItem(index);
        }
      },

      clearCart: () => set({
        cart: [],
        pendingSaleId: null,
        activeRow: -1,
        selectedRowIndex: -1,
        customerId: undefined,
        customerName: '',
        customerPhone: '',
        subtotal: 0,
        totalDiscount: 0,
        grandTotal: 0,
      }),

      setActiveRow: (index) => set({ activeRow: index, selectedRowIndex: index }),

      selectRow: (index) => set({ selectedRowIndex: index, activeRow: index }),

      selectNextRow: () => {
        const { cart, selectedRowIndex } = get();
        if (cart.length === 0) return;
        const nextIndex = Math.min(selectedRowIndex + 1, cart.length - 1);
        set({ selectedRowIndex: nextIndex, activeRow: nextIndex });
      },

      selectPreviousRow: () => {
        const { selectedRowIndex } = get();
        const prevIndex = Math.max(selectedRowIndex - 1, 0);
        set({ selectedRowIndex: prevIndex, activeRow: prevIndex });
      },

      incrementQuantity: (productId) => {
        const { cart, updateQuantity } = get();
        const item = cart.find(i => i.product.id === productId);
        if (item) {
          updateQuantity(productId, item.quantity + 1);
        }
      },

      decrementQuantity: (productId) => {
        const { cart, updateQuantity } = get();
        const item = cart.find(i => i.product.id === productId);
        if (item && item.quantity > 1) {
          updateQuantity(productId, item.quantity - 1);
        }
      },

      setScanning: (isScanning) => set({ isScanning }),

      setCommandOpen: (open) => set({ isCommandOpen: open }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setPaymentModalOpen: (open) => set({ isPaymentModalOpen: open }),

      setCustomer: (customerId, name, phone) => set({
        customerId,
        customerName: name || '',
        customerPhone: phone || '',
      }),

      completeTransaction: (paymentMethod) => {
        const { cart, grandTotal, customerName, customerPhone, pendingSaleId } = get();
        if (cart.length === 0) return null;

        // Stable across repeat calls for the SAME uncleared cart (a retry
        // after a failed/timed-out attempt reuses it instead of minting a
        // fresh one) - the backend now treats a repeat POST /rest/v1/sales
        // with the same id as a no-op instead of creating a second sale.
        const id = pendingSaleId || crypto.randomUUID();
        if (!pendingSaleId) set({ pendingSaleId: id });

        return {
          id,
          items: [...cart],
          grandTotal,
          customerName,
          customerPhone,
          paymentMethod,
        };
      },

      confirmTransaction: () => {
        get().clearCart();
      },

      getOrCreatePendingSaleId: () => {
        const { pendingSaleId } = get();
        if (pendingSaleId) return pendingSaleId;
        const id = crypto.randomUUID();
        set({ pendingSaleId: id });
        return id;
      },

      getTotal: () => {
        const { cart } = get();
        return cart.reduce((sum, item) => sum + item.lineTotal, 0);
      },
    }),
    {
      name: 'pos-storage',
      partialize: (state) => ({
        cart: state.cart,
        pendingSaleId: state.pendingSaleId,
        customerId: state.customerId,
        customerName: state.customerName,
        customerPhone: state.customerPhone,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const cart = state.cart || [];
          const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
          const totalDiscount = cart.reduce((sum, i) => sum + (i.unitPrice * i.quantity * i.discount / 100), 0);
          state.subtotal = subtotal;
          state.totalDiscount = totalDiscount;
          state.grandTotal = subtotal - totalDiscount;
        }
      },
    }
  )
);
