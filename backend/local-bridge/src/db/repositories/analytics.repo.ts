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

  getStockValuation(storeId: string): { total_cost: number; total_retail: number; item_count: number } {
    console.log('[DB] Calculating Stock Valuation for store:', storeId || 'ALL');
    const sql = `
        SELECT 
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(cost_price, 0) AS REAL)) as total_cost,
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(unit_price, 0) AS REAL)) as total_retail,
          COUNT(*) as item_count
        FROM products
        WHERE (? = '' OR store_id = ?) AND quantity > 0
    `;
    
    const row = db.prepare(sql).get(storeId || '', storeId || '') as any;
    console.log('[DB] Valuation Result:', row);
    
    return {
      total_cost: row?.total_cost || 0,
      total_retail: row?.total_retail || 0,
      item_count: row?.item_count || 0,
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
