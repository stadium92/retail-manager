import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { env } from '../env.js';
import { authenticateRequest, type Role } from './utils/auth.js';

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

const roleUpdateSchema = z.object({
  role: z.enum(['master', 'worker', 'deliverer']),
});

const verifyMasterSchema = z.object({
  password: z.string().min(1),
});

/**
 * Creates a real Supabase Auth account (+ profile + role) for a worker/
 * deliverer created on the desktop app, mirroring the cloud app's own
 * `create-user` edge function (frontend/supabase/functions/create-user).
 * Before this, local-bridge accounts were never provisioned in Supabase at
 * all (a prior, deliberate scope cut - see sync_payload_map.ts) - every
 * device kept its own siloed local account for the same person, which is
 * how the "many login conflicts" and "creds not pushed to Supabase"
 * symptoms happened. This runs synchronously at creation time (needs the
 * plaintext password, which must never be persisted to disk) rather than
 * via the async outbox, so it requires connectivity at the moment a
 * master adds a worker.
 */
async function provisionSupabaseWorker(params: {
  email: string;
  password: string;
  full_name: string;
  role: 'worker' | 'deliverer';
  store_id?: string;
  created_by: string;
}): Promise<{ userId: string }> {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error('Supabase is not configured on this build (missing URL/service key).');
  }

  const adminHeaders: Record<string, string> = {
    apikey: env.supabaseServiceKey,
    Authorization: `Bearer ${env.supabaseServiceKey}`,
    'Content-Type': 'application/json',
  };

  // Cross-device conflict check - a worker created on a different install
  // with the same email must reuse/refuse, not get a second siloed
  // identity (every device used to only ever check its own local SQLite).
  const listRes = await fetch(`${env.supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
    headers: adminHeaders,
  });
  if (!listRes.ok) {
    throw new Error(`Could not reach Supabase to check for existing accounts (HTTP ${listRes.status}).`);
  }
  const listBody = (await listRes.json()) as { users?: Array<{ email?: string }> };
  const emailExists = (listBody.users ?? []).some(
    (u) => u.email?.toLowerCase() === params.email.toLowerCase()
  );
  if (emailExists) {
    const err = new Error('A Supabase account with that email already exists.') as Error & { code?: string };
    err.code = 'SUPABASE_EMAIL_EXISTS';
    throw err;
  }

  // created_by (any non-empty string, not necessarily a real user id) stops
  // the handle_new_user_role() trigger from defaulting this account to role
  // 'master' - see Djati-stores migration
  // 20260125170000_fix_handle_new_user_role.sql.
  const createRes = await fetch(`${env.supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: { full_name: params.full_name, created_by: params.created_by },
    }),
  });
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => createRes.statusText);
    throw new Error(`Supabase rejected the new account: ${body.slice(0, 500)}`);
  }
  const created = (await createRes.json()) as { id: string };
  const supabaseUserId = created.id;

  const rollback = async () => {
    await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${supabaseUserId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    }).catch(() => {});
  };

  const profileRes = await fetch(`${env.supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...adminHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: supabaseUserId, email: params.email, full_name: params.full_name }),
  });
  if (!profileRes.ok) {
    await rollback();
    const body = await profileRes.text().catch(() => profileRes.statusText);
    throw new Error(`Failed to create Supabase profile: ${body.slice(0, 500)}`);
  }

  let roleRes = await fetch(`${env.supabaseUrl}/rest/v1/user_roles`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ user_id: supabaseUserId, role: params.role, store_id: params.store_id ?? null }),
  });
  if (!roleRes.ok && params.store_id) {
    // The store may not have reached Supabase yet (its own sync is async
    // via the outbox) - store_id is a nullable FK there, so retry without
    // it rather than fail the whole account creation over a timing gap.
    roleRes = await fetch(`${env.supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ user_id: supabaseUserId, role: params.role, store_id: null }),
    });
  }
  if (!roleRes.ok) {
    await rollback();
    const body = await roleRes.text().catch(() => roleRes.statusText);
    throw new Error(`Failed to assign Supabase role: ${body.slice(0, 500)}`);
  }

  return { userId: supabaseUserId };
}

const workerProvisionSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1),
  role: z.enum(['worker', 'deliverer']),
  store_id: z.string().min(1).optional(),
  store_name: z.string().min(1).optional(),
});

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
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


  app.post('/auth/token_exchange', async (request, reply) => {
    const parsed = z.object({
      supabase_service_key: z.string().min(1),
    }).safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    if (!env.supabaseServiceKey || parsed.data.supabase_service_key !== env.supabaseServiceKey) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid Supabase service key.' });
    }

    const now = Math.floor(Date.now() / 1000);
    const accessToken = jwt.sign(
      {
        sub: 'supabase-sync',
        email: 'supabase-sync@localbridge',
        role: 'supabase-sync',
        aud: ['localbridge'],
        iss: 'localbridge',
        type: 'access',
        iat: now,
      },
      env.jwtSecret,
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
    );

    return reply.send({
      token_type: 'bearer',
      access_token: accessToken,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    });
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
    let userId: string;
    try {
      const provisioned = await provisionSupabaseWorker({
        email,
        password,
        full_name,
        role,
        store_id: assignedStore,
        created_by: claims.sub,
      });
      userId = provisioned.userId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if ((err as { code?: string })?.code === 'SUPABASE_EMAIL_EXISTS') {
        return reply.status(409).send({
          error: 'UserExists',
          message: 'A user with that email already exists.',
        });
      }
      request.log.error({ err }, '[auth] Supabase worker provisioning failed');
      return reply.status(502).send({
        error: 'SupabaseProvisionFailed',
        message: `Could not create this account in Supabase: ${message}`,
      });
    }

    const now = new Date().toISOString();

    // userId is the real Supabase Auth id (not a locally-generated one) so
    // this account is the same identity on both sides from the start,
    // instead of two disconnected records that can never be reconciled.
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

    request.log.info('Worker %s created by %s (Supabase id %s)', email, claims.sub, userId);

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

  // Route didn't exist at all - the MasterPasswordGate dialog's fetch always
  // 404'd, so `res.ok` was always false and NO password (not even the real
  // master's own) could ever unlock a gated module on the installed app.
  // No bearer token required, same as /auth/login: this only ever listens
  // on localhost and the caller has no session yet at the point they'd use
  // it. Checks the password against every master account on this device
  // (not just one), so any master's password unlocks it for a worker.
  app.post('/rest/v1/auth/verify-master', async (request, reply) => {
    const parsed = verifyMasterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const masterRoles = db.listUserRoles('master');
    for (const role of masterRoles) {
      const user = db.getUserById(role.user_id);
      if (user && bcrypt.compareSync(parsed.data.password, user.password_hash)) {
        return reply.send({ valid: true });
      }
    }
    return reply.send({ valid: false });
  });

  // id here is user_roles.id, matching OfflineTeamService.updateWorkerRole's
  // local-bridge branch. This route didn't exist at all - every promote/
  // demote attempt from the master dashboard 404'd.
  app.patch('/auth/workers/:id/role', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const { id } = request.params as { id: string };
    const parsed = roleUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationFailed',
        details: parsed.error.flatten(),
      });
    }

    const existingRole = db.getRoleById(id);
    if (!existingRole) {
      return reply.status(404).send({ error: 'NotFound', message: 'Role not found.' });
    }

    db.updateRole(id, parsed.data.role);

    return reply.send({ id, role: parsed.data.role });
  });
}
