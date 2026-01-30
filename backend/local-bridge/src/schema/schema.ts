import {
  sqliteTable,
  text,
  integer,
  real,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  password_hash: text('password_hash').notNull(),
  full_name: text('full_name').notNull(),
  phone: text('phone'),
  role: text('role').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const user_roles = sqliteTable('user_roles', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  role: text('role').notNull(),
  store_id: text('store_id'),
  created_at: text('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token').notNull(),
  expires_at: integer('expires_at').notNull(),
  created_at: text('created_at').notNull(),
});

export const stores = sqliteTable('stores', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  owner_id: text('owner_id'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const product_families = sqliteTable('product_families', {
  id: text('id').primaryKey(),
  store_id: text('store_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  parent_id: text('parent_id'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  store_id: text('store_id').notNull(),
  name: text('name').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),
  description: text('description'),
  cost_price: real('cost_price'),
  unit_price: real('unit_price'),
  wholesale_price: real('wholesale_price'),
  min_quantity: integer('min_quantity').default(0),
  quantity: integer('quantity').default(0),
  category: text('category'),
  image_url: text('image_url'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  created_by: text('created_by'),
  updated_by: text('updated_by'),
});

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  store_id: text('store_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  balance: real('balance').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const purchase_orders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey(),
  store_id: text('store_id').notNull(),
  supplier_id: text('supplier_id').notNull(),
  status: text('status').notNull().default('draft'),
  total_amount: real('total_amount').notNull().default(0),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const purchase_items = sqliteTable('purchase_items', {
  id: text('id').primaryKey(),
  order_id: text('order_id').notNull(),
  product_id: text('product_id').notNull(),
  quantity_ordered: integer('quantity_ordered').notNull().default(0),
  quantity_received: integer('quantity_received').notNull().default(0),
  unit_cost: real('unit_cost').notNull().default(0),
  created_at: text('created_at').notNull(),
});

export const supplier_payments = sqliteTable('supplier_payments', {
  id: text('id').primaryKey(),
  store_id: text('store_id').notNull(),
  supplier_id: text('supplier_id').notNull(),
  amount: real('amount').notNull(),
  payment_method: text('payment_method').notNull().default('cash'),
  reference: text('reference'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
});

export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  store_id: text('store_id').notNull(),
  worker_id: text('worker_id'),
  customer_name: text('customer_name'),
  customer_phone: text('customer_phone'),
  sale_type: text('sale_type').notNull().default('detail'),
  total_price: real('total_price').notNull().default(0),
  discount: real('discount').default(0),
  tax: real('tax').default(0),
  payment_method: text('payment_method').default('cash'),
  payment_status: text('payment_status').default('paid'),
  notes: text('notes'),
  invoice_number: text('invoice_number'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const sale_items = sqliteTable('sale_items', {
  id: text('id').primaryKey(),
  sale_id: text('sale_id').notNull(),
  product_id: text('product_id'),
  product_name: text('product_name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unit_price: real('unit_price').notNull(),
  discount: real('discount').default(0),
  total: real('total').notNull(),
  created_at: text('created_at').notNull(),
});

export const deliveries = sqliteTable('deliveries', {
  id: text('id').primaryKey(),
  sale_id: text('sale_id'),
  store_id: text('store_id'),
  deliverer_id: text('deliverer_id'),
  customer_name: text('customer_name'),
  customer_phone: text('customer_phone'),
  delivery_address: text('delivery_address').notNull(),
  status: text('status').default('pending'),
  notes: text('notes'),
  scheduled_at: text('scheduled_at'),
  delivered_at: text('delivered_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const worker_invitations = sqliteTable('worker_invitations', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  role: text('role').notNull(),
  store_id: text('store_id'),
  invited_by: text('invited_by'),
  token: text('token').notNull(),
  status: text('status').notNull().default('pending'),
  expires_at: text('expires_at').notNull(),
  accepted_at: text('accepted_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
