import Database from 'better-sqlite3';
import { emitOutbox } from './sync_helpers.js';

export interface LocalCashTransaction {
  id: string;
  store_id: string;
  worker_id?: string | null;
  type: 'in' | 'out';
  amount: number;
  category: string;
  description?: string | null;
  reference?: string | null;
  created_at: string;
  updated_at: string;
}

export const createCashRepo = (db: Database.Database) => {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO cash_transactions (
        id, store_id, worker_id, type, amount, category, description, reference, created_at, updated_at
      ) VALUES (
        @id, @store_id, @worker_id, @type, @amount, @category, @description, @reference, @created_at, @updated_at
      )
    `),
    list: db.prepare('SELECT * FROM cash_transactions WHERE store_id = ? ORDER BY created_at DESC'),
    delete: db.prepare('DELETE FROM cash_transactions WHERE id = ?'),
  };

  return {
    listCashTransactions(storeId: string): LocalCashTransaction[] {
      return stmts.list.all(storeId) as LocalCashTransaction[];
    },

    insertCashTransaction(tx: LocalCashTransaction) {
      stmts.insert.run({
        ...tx,
        worker_id: tx.worker_id ?? null,
        description: tx.description ?? null,
        reference: tx.reference ?? null,
      });
      emitOutbox(db, tx.store_id, 'cash_transaction', tx.id, 'create', tx as unknown as Record<string, unknown>);
    },

    deleteCashTransaction(id: string) {
      const existing = db.prepare('SELECT store_id FROM cash_transactions WHERE id = ?').get(id) as { store_id: string } | undefined;
      stmts.delete.run(id);
      if (existing) {
        emitOutbox(db, existing.store_id, 'cash_transaction', id, 'delete', { id });
      }
    }
  };
};
