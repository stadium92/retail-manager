import Database from 'better-sqlite3';

export const createAnalyticsRepo = (db: Database.Database) => ({
  getDailyRevenue(storeId: string): number {
    const row = db
      .prepare(`
        SELECT SUM(COALESCE(CAST(total_price AS REAL), 0)) as total
        FROM sales
        WHERE store_id = ? AND date(created_at) = date('now')
      `)
      .get(storeId) as { total: number };
    return row?.total || 0;
  },

  getWeeklyRevenue(storeId: string): { date: string; revenue: number }[] {
    const rows = db
      .prepare(`
        SELECT date(created_at) as date, SUM(COALESCE(CAST(total_price AS REAL), 0)) as revenue
        FROM sales
        WHERE store_id = ? AND created_at >= date('now', '-6 days')
        GROUP BY date(created_at)
        ORDER BY date(created_at) ASC
      `)
      .all(storeId) as { date: string; revenue: number }[];
    return rows;
  },

  getTopProducts(storeId: string, limit = 5): { name: string; quantity: number; revenue: number }[] {
    const rows = db
      .prepare(`
        SELECT 
          si.product_name as name, 
          SUM(si.quantity) as quantity, 
          SUM(COALESCE(CAST(si.total AS REAL), 0)) as revenue
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.store_id = ?
        GROUP BY si.product_name
        ORDER BY quantity DESC
        LIMIT ?
      `)
      .all(storeId, limit) as { name: string; quantity: number; revenue: number }[];
    return rows;
  },

  getTopWorkers(storeId: string, limit = 5): { name: string; sales_count: number; revenue: number }[] {
    const rows = db
      .prepare(`
        SELECT 
          u.full_name as name, 
          COUNT(s.id) as sales_count, 
          SUM(COALESCE(CAST(s.total_price AS REAL), 0)) as revenue
        FROM sales s
        LEFT JOIN users u ON s.worker_id = u.id
        WHERE s.store_id = ?
        GROUP BY u.full_name
        ORDER BY revenue DESC
        LIMIT ?
      `)
      .all(storeId, limit) as { name: string; sales_count: number; revenue: number }[];
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
        SUM(CASE WHEN quantity > COALESCE(min_quantity, 10) THEN 1 ELSE 0 END) as ok,
        SUM(CASE WHEN quantity > 0 AND quantity <= COALESCE(min_quantity, 10) THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) as out
      FROM products
      WHERE store_id = ?
    `).get(storeId) as any;

    return {
      ok: row?.ok || 0,
      low: row?.low || 0,
      out: row?.out || 0,
    };
  },
});
