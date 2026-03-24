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
    storeId: string | null | undefined,
    query: string,
    limit: number = 50,
    offset: number = 0,
    filter?: 'in_stock' | 'out_of_stock' | 'low_stock'
  ): { data: LocalProduct[]; total: number } {
    const searchQuery = query.trim();
    const useStoreFilter = storeId && storeId !== 'all';
    
    // Base filter conditions for stock
    let filterClause = '';
    if (filter === 'in_stock') filterClause = 'AND p.quantity > 0';
    else if (filter === 'out_of_stock') filterClause = 'AND p.quantity <= 0';
    else if (filter === 'low_stock') filterClause = 'AND p.quantity > 0 AND p.quantity <= COALESCE(p.min_quantity, 0)';

    // 1. FAST PATH: If query is empty, return latest products
    if (!searchQuery) {
      const whereClause = useStoreFilter ? `WHERE p.store_id = ? ${filterClause}` : (filterClause ? `WHERE ${filterClause.slice(4)}` : '');
      const params = useStoreFilter ? [storeId] : [];

      try {
          const totalResult = db.prepare(`SELECT COUNT(*) as count FROM products p ${whereClause}`).get(...params) as { count: number };
          const rows = db.prepare(`
            SELECT p.*, pf.name as category_name 
            FROM products p 
            LEFT JOIN product_families pf ON p.category = pf.id
            ${whereClause} 
            ORDER BY p.name ASC 
            LIMIT ? OFFSET ?
          `).all(...params, limit, offset);
          
          return { 
            data: rows.map((r: any) => ({ ...r, category_name: r.category_name || null })) as LocalProduct[], 
            total: totalResult?.count || 0 
          };
      } catch (e) {
          console.error('[ProductsRepo] List products failed:', e);
          return { data: [], total: 0 };
      }
    }

    // 2. FTS5 SEARCH PATH
    try {
        const matchPattern = searchQuery.split(/\s+/).filter(Boolean).map(word => `${word}*`).join(' ');
        const whereClauseFTS = useStoreFilter ? `WHERE f.store_id = ? AND products_fts MATCH ? ${filterClause}` : `WHERE products_fts MATCH ? ${filterClause}`;
        const paramsFTS = useStoreFilter ? [storeId, matchPattern] : [matchPattern];

        const rows = db.prepare(`
            SELECT p.*, pf.name as category_name
            FROM products_fts f
            JOIN products p ON f.id = p.id
            LEFT JOIN product_families pf ON p.category = pf.id
            ${whereClauseFTS}
            ORDER BY rank
            LIMIT ? OFFSET ?
        `).all(...paramsFTS, limit, offset);

        if (rows.length > 0) {
            const countResult = db.prepare(`
                SELECT COUNT(*) as count 
                FROM products_fts f
                JOIN products p ON f.id = p.id
                ${whereClauseFTS}
            `).get(...paramsFTS) as { count: number };

            return {
                data: rows.map((r: any) => ({ ...r, category_name: r.category_name || null })) as LocalProduct[],
                total: countResult.count,
            };
        }
    } catch (ftsError) {
        console.warn('[ProductsRepo] FTS search error, using LIKE fallback');
    }

    // 3. BROAD LIKE FALLBACK (Triggers if FTS finds nothing or errors)
    try {
        const words = searchQuery.split(/\s+/).filter(Boolean);
        const likeClauses = words.map(() => `(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`).join(' AND ');
        const likeParams: any[] = [];
        words.forEach(w => {
            const p = `%${w}%`;
            likeParams.push(p, p, p);
        });

        const whereClauseLike = useStoreFilter 
            ? `WHERE p.store_id = ? AND (${likeClauses}) ${filterClause}` 
            : `WHERE (${likeClauses}) ${filterClause}`;
        
        const paramsLike = useStoreFilter ? [storeId, ...likeParams] : likeParams;

        const totalResult = db.prepare(`SELECT COUNT(*) as count FROM products p ${whereClauseLike}`).get(...paramsLike) as { count: number };
        const rows = db.prepare(`
            SELECT p.*, pf.name as category_name 
            FROM products p 
            LEFT JOIN product_families pf ON p.category = pf.id
            ${whereClauseLike} 
            ORDER BY p.name ASC 
            LIMIT ? OFFSET ?
        `).all(...paramsLike, limit, offset);

        return {
            data: rows.map((r: any) => ({ ...r, category_name: r.category_name || null })) as LocalProduct[],
            total: totalResult?.count || 0,
        };
    } catch (likeError) {
        console.error('[ProductsRepo] LIKE search failed:', likeError);
        return { data: [], total: 0 };
    }
  },

  getProductById(productId: string): LocalProduct | undefined {
    const row = db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(productId);
    return row as LocalProduct | undefined;
  },

  insertProduct(product: LocalProduct): LocalProduct | undefined {
    const result = db.prepare(`
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
          min_quantity, low_stock_threshold,
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
          @min_quantity, @low_stock_threshold,
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
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          sku = excluded.sku,
          barcode = excluded.barcode,
          description = excluded.description,
          cost_price = excluded.cost_price,
          unit_price = excluded.unit_price,
          wholesale_price = excluded.wholesale_price,
          wholesale_price_ht = excluded.wholesale_price_ht,
          wholesale_price_ttc = excluded.wholesale_price_ttc,
          selling_price_2 = excluded.selling_price_2,
          selling_price_3 = excluded.selling_price_3,
          selling_price_4 = excluded.selling_price_4,
          min_quantity = excluded.min_quantity,
          low_stock_threshold = excluded.low_stock_threshold,
          quantity = excluded.quantity,
          category = excluded.category,
          image_url = excluded.image_url,
          aisle = excluded.aisle,
          brand = excluded.brand,
          unit_type = excluded.unit_type,
          packaging = excluded.packaging,
          expiry_date = excluded.expiry_date,
          reorder_quantity = excluded.reorder_quantity,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
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
        low_stock_threshold: product.low_stock_threshold ?? product.min_quantity ?? 0,
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
    const inserted = db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(product.id) as LocalProduct | undefined;
    if (result.changes > 0) {
      emitOutbox(db, product.store_id, 'product', product.id, 'create', (inserted ?? product) as unknown as Record<string, unknown>);
    }
    return inserted;
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

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    const statement = db.prepare(`UPDATE products SET ${assignments}, version = version + 1 WHERE id = @id`);
    statement.run({ id: productId, ...Object.fromEntries(normalizedEntries) });
    const row = db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(productId);
    const updated = row as LocalProduct | undefined;
    if (updated) {
      emitOutbox(db, updated.store_id, 'product', productId, 'update', updated as unknown as Record<string, unknown>, (updated as any).version - 1);
    }
    return updated;
  },

  deleteProduct(productId: string) {
    const existing = db.prepare('SELECT store_id FROM products WHERE id = ? LIMIT 1').get(productId) as { store_id: string } | undefined;
    
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
      emitOutbox(db, existing.store_id, 'product', productId, 'delete', { id: productId });
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
        ON CONFLICT(id) DO NOTHING
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
    const transaction = db.transaction((id: string) => {
      // 1. Nullify references in products FIRST to avoid FK constraint violation
      db.prepare('UPDATE products SET category = NULL WHERE category = ?').run(id);
      // 2. Then delete the family
      db.prepare('DELETE FROM product_families WHERE id = ?').run(id);
    });
    transaction(familyId);
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
        ON CONFLICT(id) DO NOTHING
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
