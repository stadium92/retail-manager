import Database from 'better-sqlite3';
import { LocalUser, LocalRole, LocalSession } from '../types.js';

export const createAuthRepo = (db: Database.Database) => ({
  getMasterUser(): (LocalUser & LocalRole) | undefined {
    const row = db
      .prepare(`
        SELECT u.*, r.role, r.store_id
        FROM users u
        JOIN user_roles r ON r.user_id = u.id
        WHERE r.role = 'master'
        LIMIT 1
      `)
      .get();

    return row as (LocalUser & LocalRole) | undefined;
  },

  getUserByEmail(email: string): LocalUser | undefined {
    const row = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').get(email.toLowerCase());
    return row as LocalUser | undefined;
  },

  getUserById(userId: string): LocalUser | undefined {
    const row = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(userId);
    return row as LocalUser | undefined;
  },

  getRolesForUser(userId: string): LocalRole[] {
    const rows = db.prepare('SELECT * FROM user_roles WHERE user_id = ?').all(userId);
    return rows as LocalRole[];
  },

  insertUser(user: LocalUser) {
    db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, phone, created_at, updated_at, role)
        VALUES (@id, @email, @password_hash, @full_name, @phone, @created_at, @updated_at, @role)
      `)
      .run({
        ...user,
        email: user.email.toLowerCase(),
        role: (user as LocalUser & { role?: string }).role ?? 'worker',
        phone: user.phone ?? null,
      });
  },

  listUsers(): LocalUser[] {
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return rows as LocalUser[];
  },

  listUserRoles(role?: string): LocalRole[] {
    if (role) {
      return db
        .prepare('SELECT * FROM user_roles WHERE role = ? ORDER BY created_at DESC')
        .all(role) as LocalRole[];
    }
    return db
      .prepare('SELECT * FROM user_roles ORDER BY created_at DESC')
      .all() as LocalRole[];
  },

  insertRole(role: LocalRole) {
    db.prepare(`
        INSERT INTO user_roles (id, user_id, role, store_id, created_at)
        VALUES (@id, @user_id, @role, @store_id, @created_at)
      `)
      .run(role);
  },

  getSessionByRefreshToken(refreshToken: string): LocalSession | undefined {
    const row = db
      .prepare('SELECT * FROM sessions WHERE refresh_token = ? LIMIT 1')
      .get(refreshToken);
    return row as LocalSession | undefined;
  },

  createSession(session: LocalSession) {
    db.prepare(`
        INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, created_at)
        VALUES (@id, @user_id, @access_token, @refresh_token, @expires_at, @created_at)
      `)
      .run(session);
  },

  updateSessionTokens(sessionId: string, accessToken: string, refreshToken: string, expiresAt: number) {
    db.prepare(`
        UPDATE sessions
        SET access_token = ?, refresh_token = ?, expires_at = ?, created_at = ?
        WHERE id = ?
      `)
      .run(accessToken, refreshToken, expiresAt, new Date().toISOString(), sessionId);
  },

  deleteSession(sessionId: string) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  },

  deleteExpiredSessions(currentEpoch: number) {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(currentEpoch);
  },
});
