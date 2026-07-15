import { z } from 'zod';

// Sale validation schema
export const saleSchema = z.object({
  customer_name: z.string().trim().max(100, 'Customer name must be less than 100 characters').optional(),
  customer_phone: z.string()
    .regex(/^[0-9+\s()-]{0,20}$/, 'Invalid phone number format')
    .optional(),
  delivery_address: z.string().trim().max(200, 'Address must be less than 200 characters').optional(),
  quantity: z.number().int().positive('Quantity must be positive').max(10000, 'Quantity cannot exceed 10,000'),
  unit_price: z.number().positive('Price must be positive').max(1000000, 'Price cannot exceed 1,000,000'),
  item_id: z.string().uuid('Invalid item ID'),
  store_id: z.string().uuid('Invalid store ID'),
  worker_id: z.string().uuid('Invalid worker ID').optional(),
  sale_date: z.string().datetime().optional(),
});

// Inventory validation schema
export const inventorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional().nullable(),
  sku: z.string().max(50, 'SKU must be less than 50 characters').optional().nullable(),
  price: z.number().nonnegative('Price must be non-negative').max(1000000, 'Price cannot exceed 1,000,000').optional(),
  cost: z.number().nonnegative('Cost must be non-negative').max(1000000, 'Cost cannot exceed 1,000,000').optional().nullable(),
  quantity: z.number().int().nonnegative('Quantity cannot be negative').max(1000000, 'Quantity cannot exceed 1,000,000').optional(),
  low_stock_threshold: z.number().int().nonnegative('Threshold cannot be negative').optional().nullable(),
  category_id: z.string().uuid('Invalid category ID').optional().nullable(),
  store_id: z.string().uuid('Invalid store ID'),
  image_url: z.string().url('Invalid image URL').optional().nullable().or(z.literal('')),
});

// Store validation schema
export const storeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  address: z.string().trim().max(200, 'Address must be less than 200 characters').optional(),
  phone: z.string()
    .regex(/^[0-9+\s()-]{0,20}$/, 'Invalid phone number format')
    .optional(),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')),
  default_price_tier: z.number().int().min(1).max(4).optional(),
});

// Partial schemas for updates
export const saleUpdateSchema = saleSchema.partial();
export const inventoryUpdateSchema = inventorySchema.partial();
export const storeUpdateSchema = storeSchema.partial();
