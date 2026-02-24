import Database from 'better-sqlite3';
import { LocalClient } from '../types.js';
import { emitOutbox } from './sync_helpers.js';

export const createClientsRepo = (db: Database.Database) => {
  return {
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
    emitOutbox(db, client.store_id, 'client', client.id, 'create', client as unknown as Record<string, unknown>);
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
    db.prepare(`UPDATE clients SET ${assignments}, version = version + 1 WHERE id = @id`).run({
      id: clientId,
      ...Object.fromEntries(normalizedEntries),
    });
    
    const row = db.prepare('SELECT * FROM clients WHERE id = ? LIMIT 1').get(clientId);
    const updated = row as LocalClient | undefined;
    if (updated) {
      emitOutbox(db, updated.store_id, 'client', clientId, 'update', updated as unknown as Record<string, unknown>, (updated as any).version - 1);
    }
    return updated;
  },

  deleteClient(clientId: string) {
    const existing = db.prepare('SELECT store_id FROM clients WHERE id = ? LIMIT 1').get(clientId) as { store_id: string } | undefined;
    db.prepare('DELETE FROM clients WHERE id = ?').run(clientId);
    if (existing) {
      emitOutbox(db, existing.store_id, 'client', clientId, 'delete', { id: clientId });
    }
  },

  updateClientBalance(clientId: string, amount: number) {
    db.prepare(`
      UPDATE clients 
      SET current_balance = current_balance + ?, updated_at = ?
      WHERE id = ?
    `).run(amount, new Date().toISOString(), clientId);
  },

  listClientTransactions(storeId: string, clientId: string): any[] {
    // 1. Get Sales (Ventes)
    const sales = db.prepare(`
      SELECT id, 'sale' as type, total_price as amount, payment_method as method, 
             invoice_number as reference, created_at
      FROM sales
      WHERE store_id = ? AND client_id = ?
    `).all(storeId, clientId) as any[];

    // 2. Get Payments (Règlements)
    // We'll use cash_transactions category 'client_payment' for this
    const payments = db.prepare(`
      SELECT id, 'payment' as type, amount, 'cash' as method,
             reference, created_at
      FROM cash_transactions
      WHERE store_id = ? AND category = 'client_payment' AND reference = ?
    `).all(storeId, clientId) as any[];

    // Note: reference in cash_transactions for client_payment will store the clientId
    
    return [...sales, ...payments].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
};
};
