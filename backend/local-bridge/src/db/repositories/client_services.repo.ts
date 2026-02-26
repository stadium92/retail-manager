import Database from 'better-sqlite3';
import { LocalClientService } from '../types.js';

export const createClientServicesRepo = (db: Database.Database) => ({
  listClientServices(storeId?: string): LocalClientService[] {
    if (storeId) {
      const rows = db
        .prepare('SELECT * FROM client_services WHERE store_id = ? ORDER BY name ASC')
        .all(storeId);
      return rows as LocalClientService[];
    }
    const rows = db.prepare('SELECT * FROM client_services ORDER BY name ASC').all();
    return rows as LocalClientService[];
  },

  getClientServiceById(serviceId: string): LocalClientService | undefined {
    const row = db.prepare('SELECT * FROM client_services WHERE id = ? LIMIT 1').get(serviceId);
    return row as LocalClientService | undefined;
  },

  insertClientService(service: LocalClientService) {
    db.prepare(
      `
      INSERT INTO client_services (
        id,
        store_id,
        name,
        default_discount_percent,
        description,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @store_id,
        @name,
        @default_discount_percent,
        @description,
        @created_at,
        @updated_at
      )
    `
    ).run({
      ...service,
      default_discount_percent: service.default_discount_percent ?? 0,
      description: service.description ?? null,
    });
  },

  updateClientService(
    serviceId: string,
    updates: Partial<Omit<LocalClientService, 'id' | 'store_id' | 'created_at'>>
  ): LocalClientService | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = db.prepare('SELECT * FROM client_services WHERE id = ? LIMIT 1').get(serviceId);
      return row as LocalClientService | undefined;
    }

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE client_services SET ${assignments} WHERE id = @id`).run({
      id: serviceId,
      ...Object.fromEntries(normalizedEntries),
    });
    
    const row = db.prepare('SELECT * FROM client_services WHERE id = ? LIMIT 1').get(serviceId);
    return row as LocalClientService | undefined;
  },

  deleteClientService(serviceId: string) {
    db.prepare('DELETE FROM client_services WHERE id = ?').run(serviceId);
    // Optional: Set client.service_id to NULL if their service is deleted?
    // The foreign key constraints might handle or restrict this.
    // If FK constraint is strict, this delete might fail if clients use it.
    // Assuming simple delete for now. Ideally should update clients.
    db.prepare('UPDATE clients SET service_id = NULL WHERE service_id = ?').run(serviceId);
  },
});
