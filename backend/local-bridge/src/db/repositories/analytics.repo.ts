import Database from 'better-sqlite3';

// Every analytics query must exclude these, and none of them did.
//
// - A proforma is a QUOTE, not a sale. The schema's own stock trigger already
//   refuses to deduct inventory for one (schema.ts: sale_items_ai has
//   `WHEN ... sale_type != 'proforma'`), and every frontend fallback path
//   filters it out - but in local-first mode the bridge answers first, so the
//   fallback never runs and the bridge's own numbers were the ones on screen.
//   A shop that issues quotes routinely had its revenue, top products and
//   worker rankings inflated by the full value of every quote ever saved,
//   and a worker could climb the leaderboard purely by saving proformas.
// - deleted_at is part of the sync model, but no query honoured it, so a
//   voided sale counted toward revenue forever and takings could never be
//   corrected downward.
const EXCLUDE_NON_SALES = `AND sale_type != 'proforma' AND deleted_at IS NULL`;
const EXCLUDE_NON_SALES_S = `AND s.sale_type != 'proforma' AND s.deleted_at IS NULL`;

// How many times a product's own retail price a wholesale/resale tier may reach
// before we stop believing it was typed on purpose.
//
// A tier price is a DISCOUNT off retail, so the honest range is at or below 1x.
// Measured over the 687 priced in-stock rows of a real client database, the
// ratio tier/retail is: min 0.067, p25 0.688, median 0.750, p90 0.900,
// p95 0.920 - and then 8 rows above 1.0. Those 8 are not "expensive products",
// they are a single missing zero in unit_price: Boumer-TTD-2810 is stored with
// cost 55 000 and retail 6 000 but tiers 57 500 / 56 000 / 56 000, which is the
// normal descending ladder against a true retail of 60 000. Their tier prices
// are the CORRECT figures and must be kept, which is why the bound cannot sit
// at 1x, or anywhere at or below the ~9.3x such a dropped digit produces.
//
// Above that cluster the distribution is empty for three orders of magnitude
// until a lone row - "ventilateur noir 2pcs", retail 15 000, selling_price_3
// 115 001 010 - at 7 667x. Fifteen units of it contributed 1.7 BILLION CFA, 98%
// of the wholesale total, which is the whole reason this screen read 44x higher
// for wholesale than for retail.
//
// 20x is picked inside that empty gap: a little over 2x above the largest ratio
// a single dropped digit can create (so a legitimate ladder never trips it),
// and far enough below 100x that a two-digit fat-finger is still caught rather
// than quietly summed. Anything from ~10x to ~1000x yields identical totals on
// the real data, so the exact figure is not load-bearing - the margin is.
const SUSPICIOUS_TIER_RATIO = 20;

const exceedsTierBound = (col: string) =>
  `COALESCE(${col}, 0) > COALESCE(unit_price, 0) * ${SUSPICIOUS_TIER_RATIO}`;

// The value of `col`, or NULL when it is absent, zero, or implausible. NULL is
// deliberate: it lets the existing COALESCE chain fall through to the next
// candidate exactly as it does for a tier that was never filled in. The product
// keeps contributing to the total at the best price we still trust - it is
// never dropped from the valuation, which would understate it instead.
const plausibleTier = (col: string) => `
            CASE
              WHEN COALESCE(unit_price, 0) > 0 AND ${exceedsTierBound(col)} THEN NULL
              ELSE NULLIF(${col}, 0)
            END`;

// Only the tiers that actually feed total_wholesale / total_resale are counted
// as suspicious. selling_price_2 has outliers too, but flagging a price that
// changes nothing on this screen would be noise the owner cannot act on.
// unit_price > 0 is required because with no retail reference there is nothing
// to judge a tier against, and a guess would be worse than trusting the data.
const SUSPICIOUS_TIER_ROW = `(
      COALESCE(unit_price, 0) > 0 AND (
        ${['selling_price_3', 'selling_price_4', 'wholesale_price_ttc', 'wholesale_price']
          .map(exceedsTierBound)
          .join('\n        OR ')}
      )
    )`;

export const createAnalyticsRepo = (db: Database.Database) => ({
  getDailyRevenue(storeId: string, from?: string, to?: string): number {
    let sql = `
        SELECT SUM(COALESCE(CAST(total_price AS REAL), 0)) as total
        FROM sales
        WHERE (? = '' OR store_id = ?)
        ${EXCLUDE_NON_SALES}
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
        ${EXCLUDE_NON_SALES}
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
        ${EXCLUDE_NON_SALES_S}
        AND si.deleted_at IS NULL
    `;
    const params: any[] = [storeId, storeId];

    if (from && to) {
      sql += ` AND s.created_at BETWEEN ? AND ? `;
      params.push(from, to);
    }

    sql += `
        GROUP BY COALESCE(si.product_id, si.product_name)
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
          COALESCE(u.full_name, 'Inconnu') as name, 
          COUNT(s.id) as sales_count, 
          SUM(COALESCE(CAST(s.total_price AS REAL), 0)) as revenue
        FROM sales s
        LEFT JOIN users u ON s.worker_id = u.id
        WHERE (? = '' OR s.store_id = ?)
        ${EXCLUDE_NON_SALES_S}
    `;
    const params: any[] = [storeId, storeId];

    if (from && to) {
      sql += ` AND s.created_at BETWEEN ? AND ? `;
      params.push(from, to);
    }

    sql += `
        GROUP BY s.worker_id
        ORDER BY revenue DESC
        LIMIT ?
    `;
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as { name: string; sales_count: number; revenue: number }[];
    return rows;
  },

  // Real profit over a period: sum of (line total - qty x cost) across sold
  // items. Exists because the dashboard's "Marge potentielle" was previously
  // fabricated in the frontend as total_price * 0.25 - a hardcoded 25% that
  // had no relationship to cost_price and could never show a loss, on the one
  // tile a shop owner uses to judge the business.
  //
  // INNER JOIN products on purpose: an orphaned sale_item (its product was
  // hard-deleted; 23 exist on a real client database) has no knowable cost,
  // and COALESCE-ing it to 0 would book its entire revenue as pure profit.
  // Excluding it understates slightly, which is the safer direction for a
  // profit figure. Proformas and soft-deleted rows are excluded like every
  // other query here.
  getProfit(storeId: string, from?: string, to?: string): number {
    let sql = `
        SELECT SUM(
          COALESCE(CAST(si.total AS REAL), 0) -
          COALESCE(CAST(si.quantity AS REAL), 0) * COALESCE(CAST(p.cost_price AS REAL), 0)
        ) as profit
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE (? = '' OR s.store_id = ?)
        ${EXCLUDE_NON_SALES_S}
        AND si.deleted_at IS NULL
    `;
    const params: any[] = [storeId, storeId];
    if (from && to) {
      sql += ` AND s.created_at BETWEEN ? AND ? `;
      params.push(from, to);
    }
    const row = db.prepare(sql).get(...params) as { profit: number | null };
    const n = Number(row?.profit);
    return Number.isFinite(n) ? n : 0;
  },

  getStockValuation(storeId: string): {
    total_cost: number;
    total_retail: number;
    total_wholesale: number;
    total_resale: number;
    item_count: number;
    suspicious_count: number;
    suspicious_items: {
      id: string;
      name: string;
      quantity: number;
      unit_price: number;
      suspect_price: number;
    }[];
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
    //
    // plausibleTier() then wraps each candidate so that a mistyped tier is
    // skipped like a missing one instead of being trusted (see
    // SUSPICIOUS_TIER_RATIO). Note this runs per CANDIDATE, not per row: the
    // "ventilateur noir 2pcs" row whose selling_price_3 is 115 001 010 still
    // carries a real wholesale_price_ttc of 10 500, so it falls through to that
    // rather than all the way to retail. The rejected rows are counted and
    // listed back to the caller - a number this large must be visible and
    // fixable, not silently swallowed.
    const sql = `
        SELECT
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(cost_price, 0) AS REAL)) as total_cost,
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(unit_price, 0) AS REAL)) as total_retail,
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(
            ${plausibleTier('selling_price_3')},
            ${plausibleTier('wholesale_price_ttc')},
            ${plausibleTier('wholesale_price')},
            unit_price,
            0
          ) AS REAL)) as total_wholesale,
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(
            ${plausibleTier('selling_price_4')},
            ${plausibleTier('selling_price_3')},
            unit_price,
            0
          ) AS REAL)) as total_resale,
          COUNT(*) as item_count,
          SUM(CASE WHEN ${SUSPICIOUS_TIER_ROW} THEN 1 ELSE 0 END) as suspicious_count
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

    // The offenders themselves, worst first, so the warning on the stock screen
    // can name the products to correct instead of just stating a count. Ordered
    // by the damage the bad price would have done (quantity x the offending
    // amount) and capped, because the banner is a to-do list, not a report -
    // suspicious_count above still carries the true total.
    const suspiciousRows = db
      .prepare(
        `
        SELECT
          id,
          name,
          COALESCE(quantity, 0) as quantity,
          COALESCE(unit_price, 0) as unit_price,
          max(
            COALESCE(selling_price_3, 0),
            COALESCE(selling_price_4, 0),
            COALESCE(wholesale_price_ttc, 0),
            COALESCE(wholesale_price, 0)
          ) as suspect_price
        FROM products
        WHERE (? = '' OR store_id = ?) AND quantity > 0 AND ${SUSPICIOUS_TIER_ROW}
        ORDER BY COALESCE(quantity, 0) * suspect_price DESC
        LIMIT 20
    `
      )
      .all(storeId || '', storeId || '') as any[];

    return {
      total_cost: num(row?.total_cost),
      total_retail: num(row?.total_retail),
      total_wholesale: num(row?.total_wholesale),
      total_resale: num(row?.total_resale),
      item_count: num(row?.item_count),
      suspicious_count: num(row?.suspicious_count),
      suspicious_items: suspiciousRows.map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ''),
        quantity: num(r.quantity),
        unit_price: num(r.unit_price),
        suspect_price: num(r.suspect_price),
      })),
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
