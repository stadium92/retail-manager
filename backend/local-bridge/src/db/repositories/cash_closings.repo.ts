import Database from 'better-sqlite3';

export interface LocalCashClosing {
  id: string;
  store_id: string;
  worker_id?: string | null;
  cashier_name?: string | null;
  opening_balance: number;
  total_sales: number;
  expected_balance: number;
  actual_balance: number;
  difference: number;
  bill_details_json?: string | null;
  observations?: string | null;
  created_at: string;
}

export const createCashClosingsRepo = (db: Database.Database) => {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO cash_closings (
        id, store_id, worker_id, cashier_name, opening_balance, total_sales,
        expected_balance, actual_balance, difference, bill_details_json,
        observations, created_at
      ) VALUES (
        @id, @store_id, @worker_id, @cashier_name, @opening_balance, @total_sales,
        @expected_balance, @actual_balance, @difference, @bill_details_json,
        @observations, @created_at
      )
    `),
    list: db.prepare('SELECT * FROM cash_closings WHERE store_id = ? ORDER BY created_at DESC'),
  };

  return {
    listCashClosings(storeId: string): LocalCashClosing[] {
      return stmts.list.all(storeId) as LocalCashClosing[];
    },

    insertCashClosing(closing: LocalCashClosing) {
      // Local record only, not queued to the Supabase outbox - there's no
      // matching table/mapping there yet (see sync_payload_map.ts) and this
      // is a same-device end-of-day log, not data that needs central sync.
      stmts.insert.run({
        ...closing,
        worker_id: closing.worker_id ?? null,
        cashier_name: closing.cashier_name ?? null,
        bill_details_json: closing.bill_details_json ?? null,
        observations: closing.observations ?? null,
      });
    },
  };
};
