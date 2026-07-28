import Database from 'better-sqlite3';

export const createAnalyticsRepo = (db: Database.Database) => ({
  getDailyRevenue(storeId: string, from?: string, to?: string): number {
    let sql = `
        SELECT SUM(COALESCE(CAST(total_price AS REAL), 0)) as total
        FROM sales
        WHERE (? = '' OR store_id = ?)
    `;
    const params: any[] = [storeId, storeId];

    if (from && to) {
      sql += ` AND created_at BETWEEN ? AND ? `;
      params.push(from, to);
    } else {
      sql += ` AND date(created_at) = date('now') `;
    }

    const row = db.prepare(sql).get(...params) as { total: number };
    return row?.total || 0;
  },

  getWeeklyRevenue(storeId: string, from?: string, to?: string): { date: string; revenue: number }[] {
    let sql = `
        SELECT date(created_at) as date, SUM(COALESCE(CAST(total_price AS REAL), 0)) as revenue
        FROM sales
        WHERE (? = '' OR store_id = ?)
    `;
    const params: any[] = [storeId, storeId];

    if (from && to) {
      sql += ` AND created_at BETWEEN ? AND ? `;
      params.push(from, to);
    } else {
      sql += ` AND created_at >= date('now', '-6 days') `;
    }

    sql += ` GROUP BY date(created_at) ORDER BY date(created_at) ASC `;

    const rows = db.prepare(sql).all(...params) as { date: string; revenue: number }[];
    return rows;
  },

  getTopProducts(storeId: string, limit = 5, from?: string, to?: string): { name: string; quantity: number; revenue: number }[] {
    let sql = `
        SELECT 
          si.product_name as name, 
          SUM(si.quantity) as quantity, 
          SUM(COALESCE(CAST(si.total AS REAL), 0)) as revenue
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE (? = '' OR s.store_id = ?)
    `;
    const params: any[] = [storeId, storeId];

    if (from && to) {
      sql += ` AND s.created_at BETWEEN ? AND ? `;
      params.push(from, to);
    }

    sql += `
        GROUP BY si.product_name
        ORDER BY quantity DESC
        LIMIT ?
    `;
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as { name: string; quantity: number; revenue: number }[];
    return rows;
  },

  getTopWorkers(storeId: string, limit = 5, from?: string, to?: string): { name: string; sales_count: number; revenue: number }[] {
    let sql = `
        SELECT 
          u.full_name as name, 
          COUNT(s.id) as sales_count, 
          SUM(COALESCE(CAST(s.total_price AS REAL), 0)) as revenue
        FROM sales s
        LEFT JOIN users u ON s.worker_id = u.id
        WHERE (? = '' OR s.store_id = ?)
    `;
    const params: any[] = [storeId, storeId];

    if (from && to) {
      sql += ` AND s.created_at BETWEEN ? AND ? `;
      params.push(from, to);
    }

    sql += `
        GROUP BY u.full_name
        ORDER BY revenue DESC
        LIMIT ?
    `;
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as { name: string; sales_count: number; revenue: number }[];
    return rows;
  },

  getStockValuation(storeId: string): {
    total_cost: number;
    total_retail: number;
    total_wholesale: number;
    total_resale: number;
    item_count: number;
  } {
    console.log('[DB] Calculating Stock Valuation for store:', storeId || 'ALL');
    // total_wholesale and total_resale were never selected here, but
    // ValorisationStock.tsx reads them off the response - so they arrived as
    // undefined and formatCurrency(undefined) painted a literal "NaN" in the
    // VALEUR GROS and VALEUR REVENDEUR cards on the stock screen.
    //
    // Column choice follows the tiers the UI itself defines
    // ("3ème prix (Gros)" / "4ème prix (Revente)") and matches the precedence
    // already used in OfflineDataService: selling_price_3 first, falling back
    // to the legacy wholesale_* columns, which in real data are almost always
    // NULL (672 of 688 rows on the live database checked). NULLIF(...,0)
    // keeps a stored 0 from masking a usable fallback, and the final
    // COALESCE to unit_price means a product with no wholesale tier
    // contributes its retail price rather than silently counting as 0 and
    // understating the total.
    const sql = `
        SELECT
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(cost_price, 0) AS REAL)) as total_cost,
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(unit_price, 0) AS REAL)) as total_retail,
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(
            NULLIF(selling_price_3, 0),
            NULLIF(wholesale_price_ttc, 0),
            NULLIF(wholesale_price, 0),
            unit_price,
            0
          ) AS REAL)) as total_wholesale,
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(
            NULLIF(selling_price_4, 0),
            NULLIF(selling_price_3, 0),
            unit_price,
            0
          ) AS REAL)) as total_resale,
          COUNT(*) as item_count
        FROM products
        WHERE (? = '' OR store_id = ?) AND quantity > 0
    `;

    const row = db.prepare(sql).get(storeId || '', storeId || '') as any;
    console.log('[DB] Valuation Result:', row);

    // SUM() over zero matching rows returns NULL, not 0 - hence the Number()
    // plus isFinite guard rather than a bare `|| 0`, so an empty store can
    // never send NaN/null back to the client.
    const num = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    return {
      total_cost: num(row?.total_cost),
      total_retail: num(row?.total_retail),
      total_wholesale: num(row?.total_wholesale),
      total_resale: num(row?.total_resale),
      item_count: num(row?.item_count),
    };
  },

  getStockHealth(storeId: string): { ok: number; low: number; out: number } {
    const row = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN quantity > COALESCE(min_quantity, 10) THEN 1 ELSE 0 END), 0) as ok,
        COALESCE(SUM(CASE WHEN quantity > 0 AND quantity <= COALESCE(min_quantity, 10) THEN 1 ELSE 0 END), 0) as low,
        COALESCE(SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END), 0) as out
      FROM products
      WHERE (? = '' OR store_id = ?)
    `).get(storeId, storeId) as any;

    return {
      ok: row?.ok || 0,
      low: row?.low || 0,
      out: row?.out || 0,
    };
  },
});
