import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const listQuerySchema = z.object({
  store_id: z.string().optional(),
});

const createSchema = z.object({
  email: z.string().email(),
  role: z.enum(['worker', 'deliverer']),
  store_id: z.string().optional(),
});

const tokenSchema = z.object({
  token: z.string().min(1),
});

export async function registerInvitationRoutes(app: FastifyInstance) {
  app.get('/rest/v1/worker_invitations', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const parsed = listQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const invitations = db.listInvitations(parsed.data.store_id);
    return reply.send(invitations);
  });

  app.post('/rest/v1/worker_invitations', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const parsed = createSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const invitationId = crypto.randomUUID();

    db.insertInvitation({
      id: invitationId,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      store_id: parsed.data.store_id ?? claims.store_id ?? null,
      invited_by: claims.sub,
      token: crypto.randomBytes(24).toString('hex'),
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      accepted_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    const invitation = db.getInvitationById(invitationId);
    return reply.status(201).send(invitation);
  });

  app.post('/rest/v1/worker_invitations/:id/resend', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const invitationId = (request.params as { id: string }).id;
    const existing = db.getInvitationById(invitationId);
    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Invitation not found.',
      });
    }

    const updated = db.updateInvitation(invitationId, {});
    return reply.send(updated);
  });

  app.post('/rest/v1/worker_invitations/:id/cancel', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const invitationId = (request.params as { id: string }).id;
    const existing = db.getInvitationById(invitationId);
    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Invitation not found.',
      });
    }

    const updated = db.updateInvitation(invitationId, {
      status: 'cancelled',
    });
    return reply.send(updated);
  });

  app.post('/rest/v1/worker_invitations/accept', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['any']);
    if (!claims) return;

    const parsed = tokenSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const invitation = db.getInvitationByToken(parsed.data.token);
    if (!invitation) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Invitation not found.',
      });
    }

    if (invitation.status !== 'pending') {
      return reply.status(400).send({
        error: 'InvalidStatus',
        message: 'Invitation is no longer pending.',
      });
    }

    if (claims.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Invitation email does not match current user.',
      });
    }

    const updated = db.updateInvitation(invitation.id, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });

    return reply.send(updated);
  });
}
