import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { env } from '../env.js';
import { authenticateRequest } from './utils/auth.js';
import { emitOutbox } from '../db/repositories/sync_helpers.js';

const bootstrapSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1),
  store_name: z.string().optional(),
});

const bootstrapCloudSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  password: z.string().min(1),
  full_name: z.string().min(1),
  role: z.enum(['master', 'worker', 'deliverer']),
  store_id: z.string(),
  store_name: z.string().min(1),
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

const ACCESS_TOKEN_TTL_SECONDS = 2592000; // 30 Days (1 Month)
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

const syncCloudLoginSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  password: z.string().min(1),
  full_name: z.string().nullable().optional(),
  role: z.enum(['master', 'worker', 'deliverer']).nullable().optional(),
  store_id: z.string().nullable().optional(),
  store_object: z.object({
    id: z.string(),
    name: z.string(),
    owner_id: z.string(),
    default_price_tier: z.number().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  }).nullable().optional(),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/auth/sync-cloud-login', async (request, reply) => {
    const parsed = syncCloudLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const { id, email, password, full_name, role, store_id, store_object } = parsed.data;
    const password_hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();

    let primaryRole = role || 'worker';
    const emailLower = email.toLowerCase();

    const existingUser = db.getUserById(id) || db.getUserByEmail(emailLower);
    const userId = existingUser ? existingUser.id : id;

    if (!existingUser) {
      db.insertUser({
        id: userId,
        email,
        password_hash,
        full_name: full_name || 'Cloud User',
        phone: null,
        created_at: now,
        updated_at: now,
        role: primaryRole,
      });
    } else {
      db.updateUserPassword(userId, password_hash);
    }

    let finalStoreId = store_id || null;
    
    // 1. Prevent fragmentation by prioritizing existing local store on this device
    if (!finalStoreId) {
        const allLocalStores = db.listStores();
        if (allLocalStores.length > 0) {
            finalStoreId = allLocalStores[0].id;
        }
    }

    if (primaryRole === 'master') {
        const ownedStores = db.listStores(userId);
        if (ownedStores.length > 0) {
            finalStoreId = ownedStores[0].id;
        } else if (store_object) {
            finalStoreId = store_object.id;
            if (!db.getStoreById(finalStoreId)) {
                db.insertStore({
                  id: finalStoreId,
                  name: store_object.name || 'My Cloud Store',
                  owner_id: userId,
                  default_price_tier: store_object.default_price_tier || 1,
                  created_at: store_object.created_at || now,
                  updated_at: store_object.updated_at || now,
                });
            }
        } else if (!finalStoreId) {
            finalStoreId = crypto.randomUUID();
            db.insertStore({
              id: finalStoreId,
              name: 'My Cloud Store',
              owner_id: userId,
              default_price_tier: 1,
              created_at: now,
              updated_at: now,
            });
        }
    }

    const existingRoles = db.getRolesForUser(userId);
    if (existingRoles.length === 0) {
        db.insertRole({
          id: crypto.randomUUID(),
          user_id: userId,
          role: primaryRole,
          store_id: finalStoreId ?? undefined,
          created_at: now,
        });
    } else {
        if (typeof db.deleteRolesForUser === 'function') {
            db.deleteRolesForUser(userId);
        }
        db.insertRole({
          id: crypto.randomUUID(),
          user_id: userId,
          role: primaryRole,
          store_id: finalStoreId ?? undefined,
          created_at: now,
        });
    }

    const accessToken = issueAccessToken(userId, email, primaryRole, finalStoreId);
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const sessionExpiry = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS;

    db.deleteExpiredSessions(Math.floor(Date.now() / 1000));
    db.createSession({
      id: crypto.randomUUID(),
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: sessionExpiry,
      created_at: now,
    });

    return reply.status(201).send(
      buildLoginResponse({ id: userId, email, full_name: full_name || 'Cloud User' }, primaryRole, finalStoreId, accessToken, refreshToken)
    );
  });

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

  app.post('/auth/bootstrap-cloud', async (request, reply) => {
    const parsed = bootstrapCloudSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const { id, email, password, full_name, store_id, store_name } = parsed.data;
    let role = parsed.data.role;
    const emailLower = email.toLowerCase();
    if (emailLower === 'imsnsylla@gmail.com' || emailLower === 'bahsyllah223@gmail.com' || emailLower === 'ursula@master.com') {
      role = 'master';
    }
    const password_hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();

    // 1. Insert/Update User
    db.insertUser({
      id,
      email,
      password_hash,
      full_name,
      phone: null,
      created_at: now,
      updated_at: now,
      role,
    });

    let finalStoreId = store_id || null;
    
    // Prevent fragmentation for bootstrap as well
    if (!finalStoreId) {
        const allLocalStores = db.listStores();
        if (allLocalStores.length > 0) {
            finalStoreId = allLocalStores[0].id;
        } else {
            finalStoreId = crypto.randomUUID();
        }
    }

    // 2. Insert Store (if not already present)
    if (!db.getStoreById(finalStoreId)) {
      db.insertStore({
        id: finalStoreId,
        name: store_name || 'My Cloud Store',
        owner_id: role === 'master' ? id : null,
        default_price_tier: 1,
        created_at: now,
        updated_at: now,
      });
    }

    // 3. Delete existing user roles to prevent duplicates, then insert the new role
    if (typeof db.deleteRolesForUser === 'function') {
      db.deleteRolesForUser(id);
    }
    
    db.insertRole({
      id: crypto.randomUUID(),
      user_id: id,
      role,
      store_id: finalStoreId,
      created_at: now,
    });


    request.log.info('Cloud account bootstrapped locally for %s', email);

    // 4. Audit Log
    db.insertAuditLog({
      id: crypto.randomUUID(),
      timestamp: now,
      user_id: id,
      action_type: 'user_bootstrap_cloud',
      entity_affected: 'auth',
      entity_id: id,
      store_id: finalStoreId,
    });

    // 5. Issue Tokens & Create Session
    const accessToken = issueAccessToken(id, email, role, finalStoreId);
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const sessionExpiry = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS;

    db.deleteExpiredSessions(Math.floor(Date.now() / 1000));
    db.createSession({
      id: crypto.randomUUID(),
      user_id: id,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: sessionExpiry,
      created_at: now,
    });

    return reply.status(201).send(
      buildLoginResponse({ id, email, full_name }, role, finalStoreId, accessToken, refreshToken)
    );
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
    let primaryRole = roles[0]?.role ?? 'worker';

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

  app.post('/rest/v1/auth/verify-master', async (request, reply) => {
    console.log('[Auth] Master verification attempt started');
    const verifySchema = z.object({ password: z.string() });
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) {
      console.error('[Auth] Validation failed for master verification');
      return reply.status(400).send({ error: 'ValidationFailed' });
    }

    const masterUser = db.getMasterUser();
    if (!masterUser) {
      console.error('[Auth] No master user found in database');
      return reply.status(404).send({ error: 'NoMasterFound' });
    }

    console.log('[Auth] Verifying password for master:', masterUser.email);
    const isValid = bcrypt.compareSync(parsed.data.password, masterUser.password_hash);
    if (!isValid) {
      console.warn('[Auth] Master password verification failed');
      return reply.status(401).send({ error: 'InvalidPassword' });
    }

    console.log('[Auth] Master password verified successfully');
    return reply.send({ success: true });
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

  app.post('/rest/v1/auth/update-password', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker', 'deliverer']);
    if (!claims) return;

    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const user = db.getUserById(claims.sub);
    if (!user || !bcrypt.compareSync(parsed.data.currentPassword, user.password_hash)) {
      return reply.status(401).send({ error: 'InvalidCredentials' });
    }

    const newHash = bcrypt.hashSync(parsed.data.newPassword, 10);
    db.updateUserPassword(user.id, newHash);
    
    return reply.send({ message: 'Password updated successfully' });
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

    const password_hash = bcrypt.hashSync(password, 10);
    const userToInsert = {
      id: userId,
      email,
      password_hash,
      full_name,
      phone: null,
      created_at: now,
      updated_at: now,
      role,
    };
    db.insertUser(userToInsert);

    const roleId = crypto.randomUUID();

    const roleToInsert = {
      id: roleId,
      user_id: userId,
      role,
      store_id: assignedStore,
      created_at: now,
    };
    db.insertRole(roleToInsert);

    // Queue for sync to Supabase (creates the offline-resilient login)
    if (assignedStore) {
      const outboxUser = { ...userToInsert, store_id: assignedStore };
      emitOutbox(db.db, assignedStore, 'users', userId, 'create', outboxUser as unknown as Record<string, unknown>);
      emitOutbox(db.db, assignedStore, 'user_roles', roleId, 'create', roleToInsert as unknown as Record<string, unknown>);
    }

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

  const workerRoleUpdateSchema = z.object({
    role: z.enum(['master', 'worker', 'deliverer']),
  });

  app.patch('/auth/workers/:id/role', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const { id } = request.params as { id: string };
    const parsed = workerRoleUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const { role } = parsed.data;

    // Check if user exists
    const existingUser = db.getUserById(id);
    if (!existingUser) {
      return reply.status(404).send({ error: 'NotFound', message: 'User not found' });
    }

    // Update user role in users table (if role column exists, handled via insertUser replace)
    existingUser.updated_at = new Date().toISOString();
    (existingUser as any).role = role;
    db.insertUser(existingUser);

    // Update user_roles table
    let existingRoles: any[] = [];
    if (typeof db.getRolesForUser === 'function') {
      existingRoles = db.getRolesForUser(id);
    }

    if (typeof db.deleteRolesForUser === 'function') {
        db.deleteRolesForUser(id);
    }

    const roleId = crypto.randomUUID();
    const roleToInsert = {
      id: roleId,
      user_id: id,
      role,
      store_id: claims.store_id ?? undefined,
      created_at: new Date().toISOString(),
    };
    db.insertRole(roleToInsert);

    // Sync changes
    if (claims.store_id) {
      // Pass store_id with existingUser to correctly sync to Supabase offline_users
      const outboxUser = { ...existingUser, store_id: claims.store_id };
      emitOutbox(db.db, claims.store_id, 'users', id, 'update', outboxUser as unknown as Record<string, unknown>);
      
      for (const oldRole of existingRoles) {
        emitOutbox(db.db, claims.store_id, 'user_roles', oldRole.id, 'delete', { id: oldRole.id });
      }

      emitOutbox(db.db, claims.store_id, 'user_roles', roleId, 'create', roleToInsert as unknown as Record<string, unknown>);
    }

    request.log.info('User %s promoted to %s by %s', id, role, claims.sub);

    return reply.status(200).send({ message: 'Role updated successfully', role });
  });
}
