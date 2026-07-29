import Database from 'better-sqlite3';
import { LocalProduct, LocalProductFamily, LocalProductBatch, sanitizeString } from '../types.js';
import { emitOutbox } from './sync_helpers.js';

export const createProductsRepo = (db: Database.Database) => {
  return {
  listProducts(storeId: string): LocalProduct[] {
    const rows = db
      .prepare(`
        SELECT p.*, pf.name as category_name 
        FROM products p
        LEFT JOIN product_families pf ON p.category = pf.id
        WHERE p.store_id = ?
        ORDER BY p.name ASC
      `)
      .all(storeId);
      
    return rows.map((row: any) => ({
      ...row,
      category_name: row.category_name || null,
    })) as LocalProduct[];
  },

  listAllProducts(): LocalProduct[] {
    const rows = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
    return rows as LocalProduct[];
  },

  searchProducts(
    storeId: string,
    query: string,
    limit: number = 50,
    offset: number = 0,
    filter?: 'in_stock' | 'out_of_stock' | 'low_stock'
  ): { data: LocalProduct[]; total: number } {
    const searchQuery = query.trim();
    
    // If query is empty, use standard fast scan
    if (!searchQuery) {
      let filterClause = '';
      if (filter === 'in_stock') filterClause = 'AND quantity > 0';
      else if (filter === 'out_of_stock') filterClause = 'AND quantity <= 0';
      else if (filter === 'low_stock') filterClause = 'AND quantity > 0 AND quantity <= COALESCE(min_quantity, 10)';

      const total = (db.prepare(`SELECT COUNT(*) as count FROM products WHERE store_id = ? ${filterClause}`).get(storeId) as any).count;
      const rows = db.prepare(`SELECT * FROM products WHERE store_id = ? ${filterClause} ORDER BY name ASC LIMIT ? OFFSET ?`).all(storeId, limit, offset);
      return { data: rows as LocalProduct[], total };
    }

    // FTS5 MATCH pattern (prefix search for each word)
    const matchPattern = searchQuery.split(/\s+/).map(word => `${word}*`).join(' ');
    
    let filterClause = '';
    if (filter === 'in_stock') filterClause = 'AND p.quantity > 0';
    else if (filter === 'out_of_stock') filterClause = 'AND p.quantity <= 0';
    else if (filter === 'low_stock') filterClause = 'AND p.quantity > 0 AND p.quantity <= COALESCE(p.min_quantity, 10)';

    const countResult = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM products_fts f
      JOIN products p ON f.id = p.id
      WHERE f.store_id = ? 
      AND products_fts MATCH ?
      ${filterClause}
    `
      )
      .get(storeId, matchPattern) as { count: number };

    const rows = db
      .prepare(
        `
      SELECT p.*, pf.name as category_name
      FROM products_fts f
      JOIN products p ON f.id = p.id
      LEFT JOIN product_families pf ON p.category = pf.id
      WHERE f.store_id = ? 
      AND products_fts MATCH ?
      ${filterClause}
      ORDER BY rank -- FTS5 built-in relevance ranking
      LIMIT ? OFFSET ?
    `
      )
      .all(storeId, matchPattern, limit, offset);

    const mappedRows = rows.map((row: any) => ({
      ...row,
      category_name: row.category_name || null,
    }));

    return {
      data: mappedRows as LocalProduct[],
      total: countResult.count,
    };
  },

  getProductById(productId: string): LocalProduct | undefined {
    const row = db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(productId);
    return row as LocalProduct | undefined;
  },

  insertProduct(product: LocalProduct) {
    db.prepare(`
        INSERT INTO products (
          id,
          store_id,
          name,
          sku,
          barcode,
          description,
          cost_price,
          unit_price,
          wholesale_price,
          wholesale_price_ht,
          wholesale_price_ttc,
          selling_price_2,
          selling_price_3,
          selling_price_4,
          min_quantity,
          quantity,
          category,
          image_url,
          aisle,
          brand,
          unit_type,
          packaging,
          expiry_date,
          reorder_quantity,
          created_at,
          updated_at,
          created_by,
          updated_by
        ) VALUES (
          @id,
          @store_id,
          @name,
          @sku,
          @barcode,
          @description,
          @cost_price,
          @unit_price,
          @wholesale_price,
          @wholesale_price_ht,
          @wholesale_price_ttc,
          @selling_price_2,
          @selling_price_3,
          @selling_price_4,
          @min_quantity,
          @quantity,
          @category,
          @image_url,
          @aisle,
          @brand,
          @unit_type,
          @packaging,
          @expiry_date,
          @reorder_quantity,
          @created_at,
          @updated_at,
          @created_by,
          @updated_by
        )
      `)
      .run({
        ...product,
        name: sanitizeString(product.name),
        sku: sanitizeString(product.sku) ?? null,
        barcode: sanitizeString(product.barcode) ?? null,
        description: sanitizeString(product.description) ?? null,
        cost_price: product.cost_price ?? null,
        unit_price: product.unit_price ?? null,
        wholesale_price: product.wholesale_price ?? null,
        wholesale_price_ht: product.wholesale_price_ht ?? null,
        wholesale_price_ttc: product.wholesale_price_ttc ?? null,
        selling_price_2: product.selling_price_2 ?? null,
        selling_price_3: product.selling_price_3 ?? null,
        selling_price_4: product.selling_price_4 ?? null,
        min_quantity: product.min_quantity ?? 0,
        quantity: product.quantity ?? 0,
        category: product.category ?? null,
        image_url: product.image_url ?? null,
        aisle: product.aisle ?? null,
        brand: product.brand ?? null,
        unit_type: product.unit_type ?? null,
        packaging: product.packaging ?? null,
        expiry_date: product.expiry_date ?? null,
        reorder_quantity: product.reorder_quantity ?? null,
        created_by: product.created_by ?? null,
        updated_by: product.updated_by ?? null,
      });
    emitOutbox(db, product.store_id, 'product', product.id, 'create', product as unknown as Record<string, unknown>);
  },

  updateProduct(
    productId: string,
    updates: Partial<Omit<LocalProduct, 'id' | 'store_id'>>
  ): LocalProduct | undefined {
    console.log('[DB] updateProduct', productId, updates);
    // Sanitize string fields
    if (updates.name) updates.name = sanitizeString(updates.name)!;
    if (updates.sku) updates.sku = sanitizeString(updates.sku);
    if (updates.barcode) updates.barcode = sanitizeString(updates.barcode);
    if (updates.description) updates.description = sanitizeString(updates.description);

    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(productId);
      return row as LocalProduct | undefined;
    }

    // Snapshot the row BEFORE changing it. One extra indexed point-read per
    // product edit, and it is what turns a conflict report from "these two
    // numbers disagree" into "the till went 55 → 12 while the cloud went
    // 55 → 40", which is the difference between a guess and a decision.
    const before = db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(productId) as
      | Record<string, unknown>
      | undefined;

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    const statement = db.prepare(`UPDATE products SET ${assignments}, version = version + 1 WHERE id = @id`);
    statement.run({ id: productId, ...Object.fromEntries(normalizedEntries) });
    const row = db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(productId);
    const updated = row as LocalProduct | undefined;
    if (updated) {
      emitOutbox(db, updated.store_id, 'product', productId, 'update', updated as unknown as Record<string, unknown>, (updated as any).version - 1, { before: before ?? null });
    }
    return updated;
  },

  deleteProduct(productId: string) {
    // `version` is read alongside store_id so the delete can be sent with a
    // precondition. Deleting a row another writer has just edited destroys
    // strictly more than overwriting it does, and leaves nothing behind to
    // notice the loss with.
    const existing = db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(productId) as
      | (Record<string, unknown> & { store_id: string; version?: number })
      | undefined;

    const deleteTx = db.transaction(() => {
      // Nullify references in history tables (keep the record, lose the link)
      db.prepare('UPDATE sale_items SET product_id = NULL WHERE product_id = ?').run(productId);
      // Purchase items have NOT NULL constraint, so we must delete them
      db.prepare('DELETE FROM purchase_items WHERE product_id = ?').run(productId);
      
      // Delete operational data that is meaningless without product
      db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(productId);
      db.prepare('DELETE FROM replenishment_requests WHERE product_id = ?').run(productId);
      db.prepare('DELETE FROM product_batches WHERE product_id = ?').run(productId);
      try {
          db.prepare('DELETE FROM scheduled_order_items WHERE product_id = ?').run(productId);
      } catch (e) { /* ignore if table missing */ }

      // Finally delete the product
      db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    });
    
    deleteTx();

    if (existing) {
      emitOutbox(db, existing.store_id, 'product', productId, 'delete', { id: productId }, existing.version ?? null, { before: existing });
    }
  },

  listProductFamilies(storeId: string): LocalProductFamily[] {
    const rows = db
      .prepare('SELECT * FROM product_families WHERE store_id = ? ORDER BY name ASC')
      .all(storeId);
    return rows as LocalProductFamily[];
  },

  getProductFamilyById(familyId: string): LocalProductFamily | undefined {
    const row = db.prepare('SELECT * FROM product_families WHERE id = ? LIMIT 1').get(familyId);
    return row as LocalProductFamily | undefined;
  },

  insertProductFamily(family: LocalProductFamily) {
    db
      .prepare(
        `
        INSERT INTO product_families (
          id,
          store_id,
          name,
          description,
          parent_id,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @store_id,
          @name,
          @description,
          @parent_id,
          @created_at,
          @updated_at
        )
      `
      )
      .run({
        ...family,
        description: family.description ?? null,
        parent_id: family.parent_id ?? null,
      });
  },

  updateProductFamily(
    familyId: string,
    updates: Partial<Omit<LocalProductFamily, 'id' | 'store_id'>>
  ): LocalProductFamily | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = db.prepare('SELECT * FROM product_families WHERE id = ? LIMIT 1').get(familyId);
      return row as LocalProductFamily | undefined;
    }

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db
      .prepare(`UPDATE product_families SET ${assignments} WHERE id = @id`)
      .run({ id: familyId, ...Object.fromEntries(normalizedEntries) });
    
    const row = db.prepare('SELECT * FROM product_families WHERE id = ? LIMIT 1').get(familyId);
    return row as LocalProductFamily | undefined;
  },

  deleteProductFamily(familyId: string) {
    db.prepare('DELETE FROM product_families WHERE id = ?').run(familyId);
    db
      .prepare('UPDATE products SET category = NULL WHERE category = ?')
      .run(familyId);
  },

  // ===== Product Batches =====
  listProductBatches(storeId: string, productId?: string): LocalProductBatch[] {
    let sql = 'SELECT * FROM product_batches WHERE store_id = ?';
    const params: any[] = [storeId];
    if (productId) {
      sql += ' AND product_id = ?';
      params.push(productId);
    }
    sql += ' ORDER BY received_at DESC';
    const rows = db.prepare(sql).all(...params);
    return rows as LocalProductBatch[];
  },

  getProductBatchById(batchId: string): LocalProductBatch | undefined {
    const row = db.prepare('SELECT * FROM product_batches WHERE id = ? LIMIT 1').get(batchId);
    return row as LocalProductBatch | undefined;
  },

  insertProductBatch(batch: LocalProductBatch) {
    db.prepare(`
        INSERT INTO product_batches (
          id, store_id, product_id, supplier_id, purchase_order_id,
          purchase_price, purchase_type, quantity_received, quantity_remaining,
          received_at, expiry_date, notes, created_at
        ) VALUES (
          @id, @store_id, @product_id, @supplier_id, @purchase_order_id,
          @purchase_price, @purchase_type, @quantity_received, @quantity_remaining,
          @received_at, @expiry_date, @notes, @created_at
        )
      `)
      .run({
        ...batch,
        supplier_id: batch.supplier_id ?? null,
        purchase_order_id: batch.purchase_order_id ?? null,
        expiry_date: batch.expiry_date ?? null,
        notes: batch.notes ?? null,
      });
  },

  updateProductBatchQuantity(batchId: string, quantityRemaining: number) {
    db.prepare('UPDATE product_batches SET quantity_remaining = ? WHERE id = ?').run(quantityRemaining, batchId);
  },

  deleteProductBatch(batchId: string) {
    db.prepare('DELETE FROM product_batches WHERE id = ?').run(batchId);
  },
};
};
