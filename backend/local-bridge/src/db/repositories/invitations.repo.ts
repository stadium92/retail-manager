import Database from 'better-sqlite3';
import { LocalWorkerInvitation } from '../types.js';

export const createInvitationsRepo = (db: Database.Database) => ({
  listInvitations(storeId?: string): LocalWorkerInvitation[] {
    if (storeId) {
      return db
        .prepare('SELECT * FROM worker_invitations WHERE store_id = ? ORDER BY created_at DESC')
        .all(storeId) as LocalWorkerInvitation[];
    }
    return db
      .prepare('SELECT * FROM worker_invitations ORDER BY created_at DESC')
      .all() as LocalWorkerInvitation[];
  },

  getInvitationById(invitationId: string): LocalWorkerInvitation | undefined {
    const row = db
      .prepare('SELECT * FROM worker_invitations WHERE id = ? LIMIT 1')
      .get(invitationId);
    return row as LocalWorkerInvitation | undefined;
  },

  getInvitationByToken(token: string): LocalWorkerInvitation | undefined {
    const row = db
      .prepare('SELECT * FROM worker_invitations WHERE token = ? LIMIT 1')
      .get(token);
    return row as LocalWorkerInvitation | undefined;
  },

  insertInvitation(invitation: LocalWorkerInvitation) {
    db.prepare(
      `
      INSERT INTO worker_invitations (
        id,
        email,
        role,
        store_id,
        invited_by,
        token,
        status,
        expires_at,
        accepted_at,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @email,
        @role,
        @store_id,
        @invited_by,
        @token,
        @status,
        @expires_at,
        @accepted_at,
        @created_at,
        @updated_at
      )
    `
    ).run({
      ...invitation,
      store_id: invitation.store_id ?? null,
      invited_by: invitation.invited_by ?? null,
      accepted_at: invitation.accepted_at ?? null,
    });
  },

  updateInvitation(
    invitationId: string,
    updates: Partial<Omit<LocalWorkerInvitation, 'id' | 'token' | 'created_at'>>
  ): LocalWorkerInvitation | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    // If we only have 'updated_at' implicitly, we might miss the check? No, normalizedEntries only has 'updates'.
    if (normalizedEntries.length === 0) {
      // Need to use getInvitationById from *this* object? 
      // The function is inside the object returned by createInvitationsRepo.
      // I can't call `this.getInvitationById` easily if I'm returning an object literal unless I define it first.
      // Or I can just execute the query directly.
      const row = db.prepare('SELECT * FROM worker_invitations WHERE id = ? LIMIT 1').get(invitationId);
      return row as LocalWorkerInvitation | undefined;
    }

    const payload: any = {
      id: invitationId,
      updated_at: new Date().toISOString(),
      ...Object.fromEntries(
        normalizedEntries.map(([key, value]) => [
          key,
          value ?? null,
        ])
      ),
    };
    // Note: The original code used assignments including updated_at.
    // "const updateAssignments = [...normalizedEntries.map(([key]) => `${key} = @${key}`), 'updated_at = @updated_at'].join(', ');"
    
    const updateAssignments = [...normalizedEntries.map(([key]) => `${key} = @${key}`), 'updated_at = @updated_at'].join(', ');
    db.prepare(`UPDATE worker_invitations SET ${updateAssignments} WHERE id = @id`).run(payload);
    
    const row = db.prepare('SELECT * FROM worker_invitations WHERE id = ? LIMIT 1').get(invitationId);
    return row as LocalWorkerInvitation | undefined;
  }
});
