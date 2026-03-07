import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { env } from '../env.js';
import { authenticateRequest } from './utils/auth.js';

const bootstrapSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1),
  store_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const tokenSchema = z.object({
  refresh_token: z.string().min(1),
});

const workerProvisionSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1),
  role: z.enum(['worker', 'deliverer']),
  store_id: z.string().min(1).optional(),
  store_name: z.string().min(1).optional(),
});

const ACCESS_TOKEN_TTL_SECONDS = 3600; // 1 Hour
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

const issueAccessToken = (userId: string, email: string, role: string, storeId: string | null) =>
  jwt.sign(
    {
      sub: userId,
      email,
      role,
      store_id: storeId,
      aud: ['localbridge'],
      iss: 'localbridge',
      type: 'access',
    },
    env.jwtSecret,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  );

const buildLoginResponse = (
  user: { id: string; email: string; full_name: string },
  role: string,
  storeId: string | null,
  accessToken: string,
  refreshToken: string
) => ({
  token_type: 'bearer',
  access_token: accessToken,
  expires_in: ACCESS_TOKEN_TTL_SECONDS,
  refresh_token: refreshToken,
  user: {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role,
    store_id: storeId,
  },
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/auth/bootstrap', async (request, reply) => {
    const existing = db.getMasterUser();
    if (existing) {
      return reply.status(409).send({
        error: 'MasterAlreadyExists',
        message: 'A master user already exists on this device.',
      });
    }

    const parsed = bootstrapSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const { email, password, full_name, store_name } = parsed.data;
    const password_hash = bcrypt.hashSync(password, 10);

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const storeId = crypto.randomUUID();
    const storeLabel = store_name?.trim() || 'Magasin principal';

    db.insertUser({
      id: userId,
      email,
      password_hash,
      full_name,
      phone: null,
      created_at: now,
      updated_at: now,
      role: 'master',
    });

    db.insertStore({
      id: storeId,
      name: storeLabel,
      owner_id: userId,
      default_price_tier: 1,
      created_at: now,
      updated_at: now,
    });

    db.insertRole({
      id: crypto.randomUUID(),
      user_id: userId,
      role: 'master',
      store_id: storeId,
      created_at: now,
    });

    request.log.info('Master user bootstrapped for %s', email);

    db.insertAuditLog({
      id: crypto.randomUUID(),
      timestamp: now,
      user_id: userId,
      action_type: 'user_bootstrap',
      entity_affected: 'auth',
      entity_id: userId,
      store_id: storeId,
    });

    return reply.status(201).send({
      message: 'Master user created',
      store_id: storeId,
      store_name: storeLabel,
    });
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const { email, password } = parsed.data;
    const user = db.getUserByEmail(email);
    const passwordOk = user ? bcrypt.compareSync(password, user.password_hash) : false;

    if (!user || !passwordOk) {
      // Log failed login attempt
      db.insertAuditLog({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        action_type: 'user_login_failed',
        entity_affected: 'auth',
        old_value: email,
      });

      return reply.status(401).send({
        error: 'InvalidCredentials',
        message: 'Invalid email or password.',
      });
    }

    const roles = db.getRolesForUser(user.id);
    const primaryRole = roles[0]?.role ?? 'worker';
    let storeId = roles[0]?.store_id ?? null;
    if (primaryRole === 'master' && (!storeId || !db.getStoreById(storeId))) {
      const ownedStores = db.listStores(user.id);
      storeId = ownedStores[0]?.id ?? null;
    }

    const accessToken = issueAccessToken(user.id, user.email, primaryRole, storeId);
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const sessionExpiry = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS;

    db.deleteExpiredSessions(Math.floor(Date.now() / 1000));
    db.createSession({
      id: crypto.randomUUID(),
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: sessionExpiry,
      created_at: new Date().toISOString(),
    });

    db.insertAuditLog({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user_id: user.id,
      action_type: 'user_login',
      entity_affected: 'auth',
      entity_id: user.id,
      store_id: storeId,
    });

    return reply.send(buildLoginResponse(user, primaryRole, storeId, accessToken, refreshToken));
  });

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = tokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const { refresh_token } = parsed.data;
    db.deleteExpiredSessions(Math.floor(Date.now() / 1000));
    const session = db.getSessionByRefreshToken(refresh_token);

    if (!session || session.expires_at <= Math.floor(Date.now() / 1000)) {
      return reply.status(401).send({
        error: 'InvalidRefreshToken',
        message: 'Refresh token is invalid or expired.',
      });
    }

    const user = db.getUserById(session.user_id);
    if (!user) {
      db.deleteSession(session.id);
      return reply.status(401).send({
        error: 'UserNotFound',
        message: 'Associated user no longer exists.',
      });
    }

    const roles = db.getRolesForUser(user.id);
    const primaryRole = roles[0]?.role ?? 'worker';
    let storeId = roles[0]?.store_id ?? null;
    if (primaryRole === 'master' && (!storeId || !db.getStoreById(storeId))) {
      const ownedStores = db.listStores(user.id);
      storeId = ownedStores[0]?.id ?? null;
    }

    const accessToken = issueAccessToken(user.id, user.email, primaryRole, storeId);
    const newRefreshToken = crypto.randomBytes(48).toString('hex');
    const newExpiry = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS;

    db.updateSessionTokens(session.id, accessToken, newRefreshToken, newExpiry);

    return reply.send(buildLoginResponse(user, primaryRole, storeId, accessToken, newRefreshToken));
  });

  app.post('/auth/logout', async (request, reply) => {
    const parsed = tokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const { refresh_token } = parsed.data;
    const session = db.getSessionByRefreshToken(refresh_token);
    if (session) {
      db.deleteSession(session.id);
    }

    return reply.send({ message: 'Logged out' });
  });

  app.post('/auth/workers', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const parsed = workerProvisionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const { email, password, full_name, role, store_id, store_name } = parsed.data;
    const existing = db.getUserByEmail(email);
    if (existing) {
      return reply.status(409).send({
        error: 'UserExists',
        message: 'A user with that email already exists.',
      });
    }

    let assignedStore = store_id ?? claims.store_id ?? undefined;
    if (assignedStore && !db.getStoreById(assignedStore)) {
      const resolvedByName = db.getStoreByName(assignedStore) ?? (store_name ? db.getStoreByName(store_name) : undefined);
      if (resolvedByName) {
        assignedStore = resolvedByName.id;
      } else if (store_name) {
        const now = new Date().toISOString();
        db.insertStore({
          id: assignedStore,
          name: store_name,
          owner_id: claims.sub,
          default_price_tier: 1,
          created_at: now,
          updated_at: now,
        });
      } else {
        return reply.status(400).send({
          error: 'InvalidStore',
          message: 'Selected store does not exist.',
        });
      }
    }
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.insertUser({
      id: userId,
      email,
      password_hash: bcrypt.hashSync(password, 10),
      full_name,
      phone: null,
      created_at: now,
      updated_at: now,
      role,
    });

    const roleId = crypto.randomUUID();

    db.insertRole({
      id: roleId,
      user_id: userId,
      role,
      store_id: assignedStore,
      created_at: now,
    });

    request.log.info('Worker %s created by %s', email, claims.sub);

    return reply.status(201).send({
      id: userId,
      role_id: roleId,
      email,
      full_name,
      role,
      store_id: assignedStore ?? null,
      created_at: now,
    });
  });
}
