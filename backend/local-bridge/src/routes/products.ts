import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db, rawDb } from '../db/index.js';
import { emitOutbox } from '../db/repositories/sync_helpers.js';
import { authenticateRequest } from './utils/auth.js';

const listQuerySchema = z.object({
  store_id: z.string().optional(),
  product_id: z.string().optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  filter: z.enum(['in_stock', 'out_of_stock', 'low_stock']).optional(),
});

const productCreateSchema = z.object({
  store_id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  cost_price: z.number().nullable().optional(),
  unit_price: z.number().optional(),
  wholesale_price: z.number().nullable().optional(),
  wholesale_price_ht: z.number().nullable().optional(),
  wholesale_price_ttc: z.number().nullable().optional(),
  selling_price_2: z.number().nullable().optional(),
  selling_price_3: z.number().nullable().optional(),
  selling_price_4: z.number().nullable().optional(),
  min_quantity: z.number().optional(),
  low_stock_threshold: z.number().optional(),
  quantity: z.number().optional(),
  image_url: z.string().nullable().optional(),
  aisle: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  unit_type: z.string().nullable().optional(),
  packaging: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  reorder_quantity: z.number().optional(),
});

const workerCreateSchema = z.object({
  p_store_id: z.string().optional(),
  p_name: z.string().min(1),
  p_description: z.string().nullable().optional(),
  p_sku: z.string().nullable().optional(),
  p_barcode: z.string().nullable().optional(),
  p_category: z.string().nullable().optional(),
  p_unit_price: z.number().optional(),
  p_cost_price: z.number().nullable().optional(),
  p_wholesale_price: z.number().nullable().optional(),
  p_wholesale_price_ht: z.number().nullable().optional(),
  p_wholesale_price_ttc: z.number().nullable().optional(),
  p_selling_price_2: z.number().nullable().optional(),
  p_selling_price_3: z.number().nullable().optional(),
  p_selling_price_4: z.number().nullable().optional(),
  p_min_quantity: z.number().optional(),
  p_low_stock_threshold: z.number().optional(),
  p_quantity: z.number().optional(),
});

const productUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  cost_price: z.number().nullable().optional(),
  unit_price: z.number().optional(),
  wholesale_price: z.number().nullable().optional(),
  wholesale_price_ht: z.number().nullable().optional(),
  wholesale_price_ttc: z.number().nullable().optional(),
  selling_price_2: z.number().nullable().optional(),
  selling_price_3: z.number().nullable().optional(),
  selling_price_4: z.number().nullable().optional(),
  min_quantity: z.number().optional(),
  low_stock_threshold: z.number().optional(),
  quantity: z.number().optional(),
  image_url: z.string().nullable().optional(),
  aisle: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  unit_type: z.string().nullable().optional(),
  packaging: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  reorder_quantity: z.number().optional(),
});

export async function registerProductRoutes(app: FastifyInstance) {
  app.get('/rest/v1/products', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const { store_id, product_id, search, page = 1, limit = 50 } = parsed.data;
    if (product_id) {
      const product = db.getProductById(product_id);
      if (!product) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'Product not found.',
        });
      }

      const canView =
        claims.role === 'master' || (claims.store_id && claims.store_id === product.store_id);
      if (!canView) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You cannot view this product.',
        });
      }

      return reply.send([product]);
    }

    const targetStoreId = store_id === 'all' ? undefined : (store_id || claims.store_id);

    // If search or explicit pagination is requested, use the optimized search method
    if (search !== undefined || parsed.data.page !== undefined || parsed.data.limit !== undefined || parsed.data.filter !== undefined) {
       const offset = (page - 1) * limit;
       const result = db.searchProducts(targetStoreId, search || '', limit, offset, parsed.data.filter);
       return reply.send(result); // Returns { data: [...], total: N }
    }

    if (claims.role === 'master' && !targetStoreId) {
       // Master listing all products across all stores
       return reply.send(db.listAllProducts());
    }

    if (!targetStoreId && store_id !== 'all') {
      return reply.status(400).send({
        error: 'StoreRequired',
        message: 'No store specified for this request.',
      });
    }

    // Fallback to legacy behavior (fetch all) for backward compatibility
    // until frontend is fully migrated.
    const products = targetStoreId ? db.listProducts(targetStoreId) : db.listAllProducts();
    return reply.send(products);
  });

  app.post('/rest/v1/products', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = productCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const targetStoreId = body.store_id ?? claims.store_id;
    if (!targetStoreId) {
      return reply.status(400).send({
        error: 'StoreRequired',
        message: 'Store is required to create a product.',
      });
    }

    const store = db.getStoreById(targetStoreId);
    if (!store) {
      return reply.status(400).send({
        error: 'InvalidStore',
        message: 'Selected store does not exist.',
      });
    }

    if (claims.role !== 'master' && claims.store_id !== targetStoreId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You cannot create products for another store.',
      });
    }

    if (body.category) {
      const family = db.getProductFamilyById(body.category);
      if (!family) {
        return reply.status(400).send({
          error: 'InvalidFamily',
          message: 'Selected family does not exist.',
        });
      }
      if (family.store_id !== targetStoreId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Family belongs to another store.',
        });
      }
    }

    const now = new Date().toISOString();
    const productId = crypto.randomUUID();

    const product = db.insertProduct({
      id: productId,
      store_id: targetStoreId,
      name: body.name,
      description: body.description ?? null,
      sku: body.sku ?? null,
      barcode: body.barcode ?? null,
      category: body.category ?? null,
      cost_price: body.cost_price ?? null,
      unit_price: body.unit_price ?? 0,
      wholesale_price: body.wholesale_price ?? null,
      wholesale_price_ht: body.wholesale_price_ht ?? null,
      wholesale_price_ttc: body.wholesale_price_ttc ?? null,
      selling_price_2: body.selling_price_2 ?? null,
      selling_price_3: body.selling_price_3 ?? null,
      selling_price_4: body.selling_price_4 ?? null,
      min_quantity: body.min_quantity ?? 0,
      low_stock_threshold: body.low_stock_threshold ?? body.min_quantity ?? 0,
      quantity: body.quantity ?? 0,
      image_url: body.image_url ?? null,
      aisle: body.aisle ?? null,
      brand: body.brand ?? null,
      unit_type: body.unit_type ?? null,
      packaging: body.packaging ?? null,
      expiry_date: body.expiry_date ?? null,
      reorder_quantity: body.reorder_quantity ?? undefined,
      created_at: now,
      updated_at: now,
      created_by: claims.sub,
      updated_by: claims.sub,
    });

    return reply.status(201).send(product);
  });


  app.get('/rest/v1/inventory_movements', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const requestedStoreId = parsed.data.store_id;
    if (requestedStoreId) {
      return reply.send(db.listInventoryMovements(requestedStoreId));
    }

    if (claims.role === 'master') {
      return reply.send(db.listInventoryMovements(undefined));
    }

    const storeId = claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const movements = db.listInventoryMovements(storeId);
    return reply.send(movements);
  });

  app.post('/rest/v1/inventory_movements', async (request, reply) => {
    try {
      const claims = authenticateRequest(request, reply, ['master', 'worker']);
      if (!claims) return;

      const parsed = z
        .object({
          store_id: z.string().optional(),
          product_id: z.string().min(1),
          product_name: z.string().nullable().optional(),
          movement_type: z.enum(['adjustment', 'in', 'out']),
          quantity: z.number().min(0),
          reason: z.string().nullable().optional(),
          source: z.string().nullable().optional(),
        })
        .safeParse(request.body ?? {});

      if (!parsed.success) {
        console.error('[InventoryMovement] BODY:', request.body);
        console.error('[InventoryMovement] ERROR:', JSON.stringify(parsed.error.format()));
        return reply.status(400).send({ 
          error: 'ValidationFailed', 
          message: 'Données invalides', 
          details: parsed.error.flatten() 
        });
      }

      const storeId = parsed.data.store_id ?? claims.store_id;
      if (!storeId) {
        return reply.status(400).send({ error: 'StoreRequired', message: 'ID du magasin requis.' });
      }

      const product = db.getProductById(parsed.data.product_id);
      if (!product) {
        return reply.status(404).send({ error: 'NotFound', message: 'Produit non trouvé.' });
      }

      const movementId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      let nextQuantity = Number(product.quantity) || 0;
      if (parsed.data.movement_type === 'in') {
        nextQuantity += parsed.data.quantity;
      } else if (parsed.data.movement_type === 'out') {
        nextQuantity = Math.max(0, nextQuantity - parsed.data.quantity);
      } else if (parsed.data.movement_type === 'adjustment') {
        nextQuantity = Math.max(0, parsed.data.quantity);
      }

      const updatedProduct = db.updateProduct(parsed.data.product_id, {
        quantity: nextQuantity,
        updated_at: now,
        updated_by: claims.sub,
      });

      const movement = {
        id: movementId,
        store_id: storeId,
        product_id: parsed.data.product_id,
        product_name: parsed.data.product_name ?? product.name,
        movement_type: parsed.data.movement_type,
        quantity: parsed.data.quantity,
        reason: parsed.data.reason ?? null,
        source: parsed.data.source ?? null,
        created_at: now,
        created_by: claims.sub,
      };
      db.insertInventoryMovement(movement as any);

      emitOutbox(rawDb, storeId, 'inventory_movement', movementId, 'create', movement as any);
      if (updatedProduct) {
          emitOutbox(rawDb, storeId, 'product', product.id, 'update', updatedProduct as any, (updatedProduct as any).version - 1);
      }

      db.insertAuditLog({
        id: crypto.randomUUID(),
        timestamp: now,
        user_id: claims.sub,
        action_type: 'inventory_movement',
        entity_affected: 'product',
        entity_id: parsed.data.product_id,
        old_value: String(product.quantity ?? 0),
        new_value: String(nextQuantity),
        store_id: storeId,
      });

      db.insertPendingMutation({
        id: crypto.randomUUID(),
        store_id: storeId,
        mutation_type: 'upsert',
        entity: 'inventory_movements',
        payload: JSON.stringify(movement),
        created_at: now,
        status: 'pending',
      });

      return reply.send({ success: true, id: movementId, new_quantity: nextQuantity });
    } catch (e: any) {
      console.error('[InventoryMovement] Fatal error:', e);
      return reply.status(500).send({ 
        error: 'InternalServerError', 
        message: e.message || 'Une erreur interne est survenue lors de la régularisation.' 
      });
    }
  });

  app.get('/rest/v1/product_families', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({
        error: 'StoreRequired',
        message: 'No store specified for this request.',
      });
    }

    const families = db.listProductFamilies(storeId);
    return reply.send(families);
  });

  app.post('/rest/v1/product_families', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = familyCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const now = new Date().toISOString();
    const familyId = crypto.randomUUID();
    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({
        error: 'StoreRequired',
        message: 'Store is required to create a family.',
      });
    }

    const store = db.getStoreById(storeId);
    if (!store) {
      return reply.status(400).send({
        error: 'InvalidStore',
        message: 'Selected store does not exist.',
      });
    }

    db.insertProductFamily({
      id: familyId,
      store_id: storeId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      parent_id: parsed.data.parent_id ?? null,
      created_at: now,
      updated_at: now,
    });

    const family = db.getProductFamilyById(familyId);
    return reply.status(201).send(family);
  });

  app.patch('/rest/v1/product_families/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = familyUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const familyId = (request.params as { id: string }).id;
    const existing = db.getProductFamilyById(familyId);
    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Family not found.',
      });
    }

    const canModify =
      claims.role === 'master' || (claims.store_id && claims.store_id === existing.store_id);
    if (!canModify) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You cannot modify this family.',
      });
    }

    const family = db.updateProductFamily(familyId, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });
    return reply.send(family);
  });

  app.delete('/rest/v1/product_families/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const familyId = (request.params as { id: string }).id;
    const existing = db.getProductFamilyById(familyId);
    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Family not found.',
      });
    }

    if (claims.store_id && claims.store_id !== existing.store_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You cannot delete this family.',
      });
    }

    db.deleteProductFamily(familyId);
    return reply.send({ message: 'Family deleted.' });
  });

  app.post('/rpc/worker_create_product', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = workerCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const storeId = body.p_store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({
        error: 'StoreRequired',
        message: 'Store is required to create a product.',
      });
    }

    const store = db.getStoreById(storeId);
    if (!store) {
      return reply.status(400).send({
        error: 'InvalidStore',
        message: 'Selected store does not exist.',
      });
    }

    const now = new Date().toISOString();
    const productId = crypto.randomUUID();

    const product = db.insertProduct({
      id: productId,
      store_id: storeId,
      name: body.p_name,
      description: body.p_description ?? null,
      sku: body.p_sku ?? null,
      barcode: body.p_barcode ?? null,
      category: body.p_category ?? null,
      unit_price: body.p_unit_price ?? 0,
      cost_price: body.p_cost_price ?? null,
      wholesale_price: body.p_wholesale_price ?? null,
      wholesale_price_ht: body.p_wholesale_price_ht ?? null,
      wholesale_price_ttc: body.p_wholesale_price_ttc ?? null,
      selling_price_2: body.p_selling_price_2 ?? null,
      selling_price_3: body.p_selling_price_3 ?? null,
      selling_price_4: body.p_selling_price_4 ?? null,
      min_quantity: body.p_min_quantity ?? 0,
      low_stock_threshold: body.p_low_stock_threshold ?? body.p_min_quantity ?? 0,
      quantity: body.p_quantity ?? 0,
      image_url: null,
      created_at: now,
      updated_at: now,
      created_by: claims.sub,
      updated_by: claims.sub,
    });

    return reply.status(201).send(product);
  });

  app.patch('/rest/v1/products/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = productUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const productId = (request.params as { id: string }).id;
    const existing = db.getProductById(productId);
    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Product not found.',
      });
    }

    const canModify =
      claims.role === 'master' || (claims.store_id && claims.store_id === existing.store_id);
    if (!canModify) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You cannot modify this product.',
      });
    }

    if (typeof parsed.data.category === 'string' && parsed.data.category.trim()) {
      const family = db.getProductFamilyById(parsed.data.category);
      if (!family) {
        return reply.status(400).send({
          error: 'InvalidFamily',
          message: 'Selected family does not exist.',
        });
      }
      if (family.store_id !== existing.store_id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Family belongs to another store.',
        });
      }
    }

    const updates = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
      updated_by: claims.sub,
    };

    // Audit price changes
    if (parsed.data.unit_price !== undefined && parsed.data.unit_price !== existing.unit_price) {
      db.insertAuditLog({
        id: crypto.randomUUID(),
        timestamp: updates.updated_at,
        user_id: claims.sub,
        action_type: 'price_change',
        entity_affected: 'product',
        entity_id: productId,
        old_value: String(existing.unit_price),
        new_value: String(parsed.data.unit_price),
        store_id: existing.store_id,
      });
    }

    const product = db.updateProduct(productId, updates);
    return reply.send(product);
  });

  app.delete('/rest/v1/products/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const productId = (request.params as { id: string }).id;
    const existing = db.getProductById(productId);
    
    // Only check permissions if the product actually exists
    if (existing) {
      if (claims.role !== 'master' && claims.store_id !== existing.store_id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You cannot delete this product.',
        });
      }
    }

    db.deleteProduct(productId);
    return reply.send({ message: 'Product deleted.' });
  });

  // Product Batches Route
  app.get('/rest/v1/product_batches', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const query = z.object({
      store_id: z.string().optional(),
      product_id: z.string().optional(),
    }).safeParse(request.query ?? {});

    if (!query.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: query.error.flatten() });
    }

    const storeId = query.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    if (claims.role !== 'master' && claims.store_id !== storeId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'You cannot view batches for another store.' });
    }

    return reply.send(db.listProductBatches(storeId, query.data.product_id));
  });
}
const familyCreateSchema = z.object({
  store_id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
});

const familyUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
});
