import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types for Master Data entities
export interface Store {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  owner_id?: string;
  default_price_tier: number;
  created_at: string;
  updated_at: string;
}

export interface ProductMaster {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  purchase_price?: number;
  selling_price_detail?: number;
  
  // New price tiers
  selling_price_2?: number;
  selling_price_3?: number;
  selling_price_4?: number;
  
  // Deprecated but kept for compatibility
  selling_price_wholesale?: number; 

  // Wholesale specific
  wholesale_price_ht?: number;
  wholesale_price_ttc?: number;

  min_stock_alert?: number;
  current_stock: number;
  unit_type?: string;
  family_id?: string;
  brand?: string;
  expiry_date?: string;
  last_sale_date?: string;
  last_purchase_date?: string;
  preferred_supplier_id?: string;
  store_id: string;
  image_url?: string;
  packaging?: string; // e.g. "12", "6x1L"
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit?: number;
  current_balance: number;
  loyalty_points?: number;
  service_id?: string;
  store_id: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  lead_time_days?: number;
  balance: number;
  default_purchase_type?: string;
  price_notes?: string;
  store_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProductFamily {
  id: string;
  name: string;
  parent_id?: string;
  description?: string;
  store_id: string;
  created_at: string;
  updated_at: string;
}

export interface MasterUser {
  id: string;
  email: string;
  full_name: string;
}

export interface ClientService {
  id: string;
  name: string;
  default_discount_percent?: number;
  store_id: string;
  created_at: string;
  updated_at: string;
}

interface MasterDataState {
  stores: Store[];
  products: ProductMaster[];
  clients: Client[];
  suppliers: Supplier[];
  families: ProductFamily[];
  services: ClientService[];
  users: MasterUser[];
  isLoading: boolean;
  lastSync: string | null;

  // Actions
  setStores: (stores: Store[]) => void;
  setProducts: (products: ProductMaster[]) => void;
  setUsers: (users: MasterUser[]) => void;
  addProduct: (product: ProductMaster) => void;
  updateProduct: (id: string, updates: Partial<ProductMaster>) => void;
  deleteProduct: (id: string) => void;

  setClients: (clients: Client[]) => void;
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  setSuppliers: (suppliers: Supplier[]) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  setFamilies: (families: ProductFamily[]) => void;
  addFamily: (family: ProductFamily) => void;
  updateFamily: (id: string, updates: Partial<ProductFamily>) => void;
  deleteFamily: (id: string) => void;

  setServices: (services: ClientService[]) => void;
  addService: (service: ClientService) => void;
  updateService: (id: string, updates: Partial<ClientService>) => void;
  deleteService: (id: string) => void;

  setLoading: (loading: boolean) => void;
  setLastSync: (date: string) => void;
  clearAll: () => void;
}

export const useMasterDataStore = create<MasterDataState>()(
  persist(
    (set) => ({
      stores: [],
      products: [],
      clients: [],
      suppliers: [],
      families: [],
      services: [],
      users: [],
      isLoading: false,
      lastSync: null,

      setStores: (stores) => set({ stores }),
      setProducts: (products) => set({ products }),
      setUsers: (users) => set({ users }),
      
      // Product actions
      addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
      updateProduct: (id, updates) => set((state) => ({
        products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      })),
      deleteProduct: (id) => set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      })),

      // Client actions
      setClients: (clients) => set({ clients }),
      addClient: (client) => set((state) => ({ clients: [...state.clients, client] })),
      updateClient: (id, updates) => set((state) => ({
        clients: state.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      })),
      deleteClient: (id) => set((state) => ({
        clients: state.clients.filter((c) => c.id !== id),
      })),

      // Supplier actions
      setSuppliers: (suppliers) => set({ suppliers }),
      addSupplier: (supplier) => set((state) => ({ suppliers: [...state.suppliers, supplier] })),
      updateSupplier: (id, updates) => set((state) => ({
        suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      })),
      deleteSupplier: (id) => set((state) => ({
        suppliers: state.suppliers.filter((s) => s.id !== id),
      })),

      // Family actions
      setFamilies: (families) => set({ families }),
      addFamily: (family) => set((state) => ({ families: [...state.families, family] })),
      updateFamily: (id, updates) => set((state) => ({
        families: state.families.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      })),
      deleteFamily: (id) => set((state) => ({
        families: state.families.filter((f) => f.id !== id),
      })),

      // Service actions
      setServices: (services) => set({ services }),
      addService: (service) => set((state) => ({ services: [...state.services, service] })),
      updateService: (id, updates) => set((state) => ({
        services: state.services.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      })),
      deleteService: (id) => set((state) => ({
        services: state.services.filter((s) => s.id !== id),
      })),

      setLoading: (isLoading) => set({ isLoading }),
      setLastSync: (lastSync) => set({ lastSync }),
      clearAll: () => set({
        stores: [],
        products: [],
        clients: [],
        suppliers: [],
        families: [],
        services: [],
        users: [],
        lastSync: null,
      }),
    }),
    {
      name: 'master-data-storage',
      partialize: (state) => ({
        stores: state.stores,
        products: state.products,
        clients: state.clients,
        suppliers: state.suppliers,
        families: state.families,
        services: state.services,
        users: state.users,
        lastSync: state.lastSync,
      }),
    }
  )
);
