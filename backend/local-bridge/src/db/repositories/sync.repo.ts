import Database from 'better-sqlite3';
import { LocalPendingMutation } from '../types.js';

export const createSyncRepo = (db: Database.Database) => ({
  listPendingMutations(status: 'pending' | 'synced' | 'failed' = 'pending'): LocalPendingMutation[] {
    const rows = db
      .prepare('SELECT * FROM pending_mutations WHERE status = ? ORDER BY created_at ASC')
      .all(status);
    return rows as LocalPendingMutation[];
  },

  insertPendingMutation(mutation: LocalPendingMutation) {
    db.prepare(
      `
      INSERT INTO pending_mutations (
        id,
        store_id,
        mutation_type,
        entity,
        payload,
        created_at,
        status
      ) VALUES (
        @id,
        @store_id,
        @mutation_type,
        @entity,
        @payload,
        @created_at,
        @status
      )
    `
    ).run({
      ...mutation,
      store_id: mutation.store_id ?? null,
    });
  },

  updatePendingMutationStatus(id: string, status: 'pending' | 'synced' | 'failed') {
    db.prepare('UPDATE pending_mutations SET status = ? WHERE id = ?').run(status, id);
  },
});
