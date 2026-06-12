export type AppRole = 'master' | 'worker' | 'deliverer' | 'customer';
export type DeliveryStatus = 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
export type SalesStatus = 'good' | 'bad' | 'worse';
export type SaleType = 'detail' | 'gros' | 'proforma';
export type PaymentStatus = 'paid' | 'pending' | 'partial';

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

export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  store_id?: string;
  sub_role?: 'cook' | 'cashier' | 'waiter' | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  store_id: string;
  created_at: string;
  updated_at: string;
}

// Product type (matches 'products' table)
export interface Product {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  category?: string;
  unit_price: number;
  wholesale_price?: number;
  wholesale_price_ht?: number;
  wholesale_price_ttc?: number;
  
  // New price tiers
  selling_price_2?: number;
  selling_price_3?: number;
  selling_price_4?: number;

  cost_price?: number;
  quantity: number;
  min_quantity?: number;
  image_url?: string;
  is_active?: boolean;
  unit_type?: string;
  packaging?: string;
  expiry_date?: string;
  // Restaurant-specific fields
  prep_time_minutes?: number;
  is_available?: boolean;
  allergens?: string[] | string;
  course_type?: string;
  modifiers?: any[] | string;
  created_at: string;
  updated_at: string;
}

// Legacy alias for compatibility
export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  wholesale_price?: number;
  wholesale_price_ht?: number;
  wholesale_price_ttc?: number;
  
  // New price tiers
  selling_price_2?: number;
  selling_price_3?: number;
  selling_price_4?: number;
  cost?: number;
  quantity: number;
  low_stock_threshold?: number;
  category_id?: string;
  store_id: string;
  image_url?: string;
  // New fields
  aisle?: string;
  brand?: string;
  unit_type?: string;
  packaging?: string;
  expiry_date?: string;
  reorder_quantity?: number;
  // Restaurant-specific fields
  prep_time_minutes?: number;
  is_available?: boolean;
  allergens?: string[] | string;
  course_type?: string;
  modifiers?: any[] | string;
  item_type?: 'product' | 'dish' | 'pack';
  pack_items?: any[] | string;
  
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  store_id: string;
  worker_id?: string;
  customer_name?: string;
  customer_phone?: string;
  sale_type: SaleType;
  total_price: number;
  discount?: number;
  tax?: number;
  payment_method?: string;
  payment_status?: PaymentStatus;
  notes?: string;
  invoice_number?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  total: number;
  created_at: string;
}

export interface Delivery {
  id: string;
  sale_id?: string;
  store_id?: string;
  deliverer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address: string;
  status: DeliveryStatus;
  notes?: string;
  scheduled_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerInvitation {
  id: string;
  email: string;
  role: AppRole;
  store_id?: string;
  invited_by?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface SaleWithDetails extends Sale {
  items?: SaleItem[];
  worker?: Profile;
  store?: Store;
}

export interface DeliveryWithDetails extends Delivery {
  sale?: Sale;
  store?: Store;
}

// Analytics types
export interface DashboardMetrics {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  totalStores: number;
  activeWorkers: number;
  lowStockItems: number;
  pendingDeliveries: number;
  salesStatus: SalesStatus;
  salesTrend: 'up' | 'down' | 'stable';
}

export interface WorkerPerformance {
  worker_id: string;
  worker_name: string;
  sales_count: number;
  total_revenue: number;
  average_transaction: number;
  weighted_average: number;
}

export interface SalesChartData {
  date: string;
  sales: number;
  revenue: number;
}

// Legacy type - kept for backward compatibility
export interface Deliverer {
  id: string;
  user_id?: string;
  full_name: string;
  phone: string;
  email?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  store_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}