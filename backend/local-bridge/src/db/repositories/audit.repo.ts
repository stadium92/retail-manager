import Database from 'better-sqlite3';
import { LocalAuditLog } from '../types.js';

export const createAuditRepo = (db: Database.Database) => ({
  insertAuditLog(log: LocalAuditLog) {
    db.prepare(
      `
      INSERT INTO audit_logs (
        id, timestamp, user_id, action_type, entity_affected, entity_id, old_value, new_value, ip_address, store_id, severity, app_version
      ) VALUES (
        @id, @timestamp, @user_id, @action_type, @entity_affected, @entity_id, @old_value, @new_value, @ip_address, @store_id, @severity, @app_version
      )
    `
    ).run({
      ...log,
      user_id: log.user_id ?? null,
      entity_affected: log.entity_affected ?? null,
      entity_id: log.entity_id ?? null,
      old_value: log.old_value ?? null,
      new_value: log.new_value ?? null,
      ip_address: log.ip_address ?? null,
      store_id: log.store_id ?? null,
      severity: log.severity ?? 'INFO',
      app_version: log.app_version ?? null,
    });
  },

  listAuditLogs(options: {
    store_id?: string;
    user_id?: string;
    action_type?: string;
    limit?: number;
    offset?: number;
  }): { data: LocalAuditLog[]; total: number } {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
    const params: any = {};

    if (options.store_id) {
      sql += ' AND store_id = @store_id';
      countSql += ' AND store_id = @store_id';
      params.store_id = options.store_id;
    }
    if (options.user_id) {
      sql += ' AND user_id = @user_id';
      countSql += ' AND user_id = @user_id';
      params.user_id = options.user_id;
    }
    if (options.action_type) {
      sql += ' AND action_type = @action_type';
      countSql += ' AND action_type = @action_type';
      params.action_type = options.action_type;
    }

    const total = (db.prepare(countSql).get(params) as { count: number }).count;

    sql += ' ORDER BY timestamp DESC LIMIT @limit OFFSET @offset';
    params.limit = options.limit ?? 50;
    params.offset = options.offset ?? 0;

    const rows = db.prepare(sql).all(params) as LocalAuditLog[];

    return { data: rows, total };
  },
});
