import Database from 'better-sqlite3';
import { LocalCashierCredit } from '../types.js';
import { emitOutbox } from './sync_helpers.js';

export const createCashierCreditsRepo = (db: Database.Database) => {
  return {
    listCashierCredits(storeId?: string): LocalCashierCredit[] {
      if (storeId) {
        const rows = db
          .prepare('SELECT * FROM cashier_credits WHERE store_id = ? ORDER BY created_at DESC')
          .all(storeId);
        return rows as LocalCashierCredit[];
      }
      const rows = db.prepare('SELECT * FROM cashier_credits ORDER BY created_at DESC').all();
      return rows as LocalCashierCredit[];
    },

    getCashierCreditById(id: string): LocalCashierCredit | undefined {
      const row = db.prepare('SELECT * FROM cashier_credits WHERE id = ? LIMIT 1').get(id);
      return row as LocalCashierCredit | undefined;
    },

    insertCashierCredit(credit: LocalCashierCredit) {
      db.prepare(
        `
        INSERT INTO cashier_credits (
          id,
          store_id,
          worker_id,
          client_name,
          amount,
          status,
          notes,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @store_id,
          @worker_id,
          @client_name,
          @amount,
          @status,
          @notes,
          @created_at,
          @updated_at
        )
      `
      ).run({
        ...credit,
        notes: credit.notes ?? null,
        status: credit.status ?? 'unpaid',
      });
      emitOutbox(db, credit.store_id, 'cashier_credit', credit.id, 'create', credit as unknown as Record<string, unknown>);
    },

    updateCashierCreditStatus(
      id: string,
      status: 'unpaid' | 'paid'
    ): LocalCashierCredit | undefined {
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE cashier_credits 
         SET status = ?, updated_at = ?, version = version + 1 
         WHERE id = ?`
      ).run(status, now, id);

      const row = db.prepare('SELECT * FROM cashier_credits WHERE id = ? LIMIT 1').get(id);
      const updated = row as LocalCashierCredit | undefined;
      if (updated) {
        emitOutbox(
          db,
          updated.store_id,
          'cashier_credit',
          id,
          'update',
          updated as unknown as Record<string, unknown>,
          (updated as any).version - 1
        );
      }
      return updated;
    },

    deleteCashierCredit(id: string) {
      const existing = db
        .prepare('SELECT store_id FROM cashier_credits WHERE id = ? LIMIT 1')
        .get(id) as { store_id: string } | undefined;
      db.prepare('DELETE FROM cashier_credits WHERE id = ?').run(id);
      if (existing) {
        emitOutbox(db, existing.store_id, 'cashier_credit', id, 'delete', { id });
      }
    },
  };
};
