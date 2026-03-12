import Database from 'better-sqlite3';
import { emitOutbox } from './sync_helpers.js';

export interface LocalCashClosing {
  id: string;
  store_id: string;
  worker_id: string;
  opening_balance?: number;
  expected_balance?: number;
  actual_balance: number;
  difference?: number;
  bill_details_json: string;
  observations?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
}

export const createCashClosingRepo = (db: Database.Database) => {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO cash_closings (
        id, store_id, worker_id, opening_balance, expected_balance, actual_balance, 
        difference, bill_details_json, observations, status, created_at, updated_at
      ) VALUES (
        @id, @store_id, @worker_id, @opening_balance, @expected_balance, @actual_balance,
        @difference, @bill_details_json, @observations, @status, @created_at, @updated_at
      )
    `),
    list: db.prepare('SELECT * FROM cash_closings WHERE store_id = ? ORDER BY created_at DESC'),
    get: db.prepare('SELECT * FROM cash_closings WHERE id = ?'),
    delete: db.prepare('DELETE FROM cash_closings WHERE id = ?'),
  };

  return {
    listCashClosings(storeId: string): LocalCashClosing[] {
      return stmts.list.all(storeId) as LocalCashClosing[];
    },

    getCashClosing(id: string): LocalCashClosing | undefined {
      return stmts.get.get(id) as LocalCashClosing | undefined;
    },

    insertCashClosing(closing: LocalCashClosing) {
      stmts.insert.run({
        ...closing,
        opening_balance: closing.opening_balance ?? 0,
        expected_balance: closing.expected_balance ?? 0,
        difference: closing.difference ?? 0,
        observations: closing.observations ?? null,
        status: closing.status ?? 'submitted',
      });
      emitOutbox(db, closing.store_id, 'cash_closing', closing.id, 'create', closing as unknown as Record<string, unknown>);
    },

    deleteCashClosing(id: string) {
      const existing = stmts.get.get(id) as { store_id: string } | undefined;
      stmts.delete.run(id);
      if (existing) {
        emitOutbox(db, existing.store_id, 'cash_closing', id, 'delete', { id });
      }
    }
  };
};
