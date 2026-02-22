import Database from 'better-sqlite3';
import { LocalClient } from '../types.js';

export const createClientsRepo = (db: Database.Database) => ({
  listClients(storeId?: string): LocalClient[] {
    if (storeId) {
      const rows = db
        .prepare('SELECT * FROM clients WHERE store_id = ? ORDER BY name ASC')
        .all(storeId);
      return rows as LocalClient[];
    }
    const rows = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
    return rows as LocalClient[];
  },

  getClientById(clientId: string): LocalClient | undefined {
    const row = db.prepare('SELECT * FROM clients WHERE id = ? LIMIT 1').get(clientId);
    return row as LocalClient | undefined;
  },

  getClientByCode(code: string, storeId: string): LocalClient | undefined {
    const row = db
      .prepare('SELECT * FROM clients WHERE code = ? AND store_id = ? LIMIT 1')
      .get(code, storeId);
    return row as LocalClient | undefined;
  },

  insertClient(client: LocalClient) {
    db.prepare(
      `
      INSERT INTO clients (
        id,
        store_id,
        service_id,
        name,
        code,
        phone,
        email,
        address,
        credit_limit,
        current_balance,
        loyalty_points,
        notes,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @store_id,
        @service_id,
        @name,
        @code,
        @phone,
        @email,
        @address,
        @credit_limit,
        @current_balance,
        @loyalty_points,
        @notes,
        @created_at,
        @updated_at
      )
    `
    ).run({
      ...client,
      service_id: client.service_id ?? null,
      code: client.code ?? null,
      phone: client.phone ?? null,
      email: client.email ?? null,
      address: client.address ?? null,
      credit_limit: client.credit_limit ?? 0,
      current_balance: client.current_balance ?? 0,
      loyalty_points: client.loyalty_points ?? 0,
      notes: client.notes ?? null,
    });
  },

  updateClient(
    clientId: string,
    updates: Partial<Omit<LocalClient, 'id' | 'store_id' | 'created_at'>>
  ): LocalClient | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = db.prepare('SELECT * FROM clients WHERE id = ? LIMIT 1').get(clientId);
      return row as LocalClient | undefined;
    }

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE clients SET ${assignments} WHERE id = @id`).run({
      id: clientId,
      ...Object.fromEntries(normalizedEntries),
    });
    
    const row = db.prepare('SELECT * FROM clients WHERE id = ? LIMIT 1').get(clientId);
    return row as LocalClient | undefined;
  },

  deleteClient(clientId: string) {
    db.prepare('DELETE FROM clients WHERE id = ?').run(clientId);
  },

  updateClientBalance(clientId: string, amount: number) {
    db.prepare(`
      UPDATE clients 
      SET current_balance = current_balance + ?, updated_at = ?
      WHERE id = ?
    `).run(amount, new Date().toISOString(), clientId);
  },
});
