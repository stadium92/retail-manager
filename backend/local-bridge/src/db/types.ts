export interface LocalUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone?: string | null;
  created_at: string;
  updated_at: string;
  role?: "master" | "worker" | "deliverer";
}

export interface LocalRole {
  id: string;
  user_id: string;
  role: 'master' | 'worker' | 'deliverer';
  store_id?: string;
  created_at: string;
}

export interface LocalSession {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  created_at: string;
}

export interface LocalStore {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  owner_id?: string | null;
  default_price_tier: number;
  created_at: string;
  updated_at: string;
}

export interface LocalWorkerInvitation {
  id: string;
  email: string;
  role: 'worker' | 'deliverer';
  store_id?: string | null;
  invited_by?: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalProductFamily {
  id: string;
  store_id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalProduct {
  id: string;
  store_id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  cost_price?: number | null;
  unit_price?: number | null;
  wholesale_price?: number | null; // Deprecated/Generic
  wholesale_price_ht?: number | null;
  wholesale_price_ttc?: number | null;
  
  // New price tiers
  selling_price_2?: number | null;
  selling_price_3?: number | null;
  selling_price_4?: number | null;

  min_quantity?: number;
  quantity?: number;
  category?: string | null;
  image_url?: string | null;
  aisle?: string | null;
  brand?: string | null;
  unit_type?: string | null;
  packaging?: string | null;
  expiry_date?: string | null;
  reorder_quantity?: number;
  
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface LocalProductBatch {
  id: string;
  store_id: string;
  product_id: string;
  supplier_id?: string | null;
  purchase_order_id?: string | null;
  purchase_price: number;
  purchase_type: string; // 'wholesale' | 'resale' | 'discount' | 'other'
  quantity_received: number;
  quantity_remaining: number;
  received_at: string;
  expiry_date?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface LocalClient {
  id: string;
  store_id: string;
  service_id?: string | null;
  name: string;
  code?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  credit_limit?: number | null;
  current_balance: number;
  loyalty_points?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalClientService {
  id: string;
  store_id: string;
  name: string;
  default_discount_percent: number;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalSupplier {
  id: string;
  store_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  balance: number;
  default_purchase_type?: string | null;
  price_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalPurchaseOrder {
  id: string;
  store_id: string;
  supplier_id: string;
  status: 'draft' | 'ordered' | 'received' | 'partial';
  total_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalPurchaseItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  created_at: string;
}

export interface LocalSupplierPayment {
  id: string;
  store_id: string;
  supplier_id: string;
  amount: number;
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
  confirmed_at?: string | null;
  created_at: string;
}

export interface LocalSupplierTransaction {
  id: string;
  type: 'payment' | 'purchase';
  amount: number;
  method?: string;
  status?: string;
  created_at: string;
  notes?: string;
  confirmed_at?: string | null;
}

export interface LocalDelivery {
  id: string;
  sale_id?: string | null;
  store_id?: string | null;
  deliverer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address: string;
  status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
  notes?: string | null;
  scheduled_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalSale {
  id: string;
  store_id: string;
  worker_id?: string | null;
  client_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sale_type: 'detail' | 'gros' | 'proforma';
  total_price: number;
  discount?: number | null;
  tax?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  notes?: string | null;
  invoice_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalSaleItem {
  id: string;
  sale_id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number | null;
  total: number;
  batch_id?: string | null;
  created_at: string;
}

export interface LocalScheduledOrder {
  id: string;
  store_id: string;
  supplier_id?: string | null;
  name: string;
  recurrence_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurrence_value: string;
  next_run_date: string;
  is_active: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface LocalScheduledOrderItem {
  id: string;
  scheduled_order_id: string;
  product_id: string;
  quantity: number;
}


export interface LocalInventoryMovement {
  id: string;
  store_id: string;
  product_id: string;
  product_name?: string | null;
  movement_type: 'adjustment' | 'in' | 'out';
  quantity: number;
  reason?: string | null;
  source?: string | null;
  batch_id?: string | null;
  created_at: string;
  created_by?: string | null;
}


export interface LocalPendingMutation {
  id: string;
  store_id?: string | null;
  mutation_type: string;
  entity: string;
  payload: string;
  created_at: string;
  status: 'pending' | 'synced' | 'failed';
}

export interface SyncOutboxEntry {
  id: string;
  store_id: string;
  entity_type: string;
  entity_id: string;
  op_type: 'create' | 'update' | 'delete';
  payload_json: string;
  base_version: number | null;
  created_at: string;
  status: 'pending' | 'sent' | 'acked' | 'failed';
  retry_count: number;
  last_error: string | null;
  idempotency_key: string;
}

export interface SyncState {
  store_id: string;
  last_push_at: string | null;
  last_pull_cursor: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

export interface LocalReplenishmentRequest {
  id: string;
  store_id: string;
  product_id: string;
  requested_by?: string | null;
  quantity_requested?: number | null;
  reason?: string | null;
  status: 'pending' | 'ordered' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface LocalAuditLog {
  id: string;
  timestamp: string;
  user_id?: string | null;
  action_type: string;
  entity_affected?: string | null;
  entity_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  ip_address?: string | null;
  store_id?: string | null;
  severity?: 'INFO' | 'WARN' | 'ERROR';
  app_version?: string;
}

export interface ReplenishmentNeed {
  product_id: string;
  product_name: string;
  sku?: string;
  current_stock: number;
  min_stock: number;
  unit_type?: string;
  packaging?: string;
  unit_price?: number;
  cost_price?: number;
  supplier_id?: string;
  supplier_name?: string;
  source: 'low_stock' | 'worker_request';
  suggested_qty: number;
  request_id?: string;
  request_reason?: string;
  requester_name?: string;
  cost_price?: number;
  wholesale_price_ht?: number;
  wholesale_price_ttc?: number;
  selling_price_2?: number;
  selling_price_3?: number;
  selling_price_4?: number;
}

// Helper to prevent database corruption from null bytes or control characters
export const sanitizeString = (str?: string | null) => {
  if (!str) return str;
  // Remove control characters (0-31) except newlines/tabs, and delete (127)
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
};
