import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import { env } from './env.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerProductRoutes } from './routes/products.js';
import { registerInvitationRoutes } from './routes/invitations.js';
import { registerPurchasingRoutes } from './routes/purchasing.js';
import { registerDeliveryRoutes } from './routes/deliveries.js';
import { registerTeamRoutes } from './routes/team.js';
import { registerSalesRoutes } from './routes/sales.js';
import { registerStoreRoutes } from './routes/stores.js';
import { registerClientsRoutes } from './routes/clients.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerCashRoutes } from './routes/cash.js';
import { registerSystemRoutes } from './routes/system.js';
import { db } from './db/index.js';
import { runScheduler } from './scheduler.js';
import jwt from 'jsonwebtoken';
import { runWithActor } from './sync/actor_context.js';

// Emergency logging
const logDir = path.join(process.env.LOCALAPPDATA || '', 'retail-manager-logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'backend-startup.log');

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {
    // ignore
  }
}

process.on('uncaughtException', (err) => {
  log(`CRITICAL: Uncaught Exception: ${err.message}\n${err.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`CRITICAL: Unhandled Rejection at: ${promise} reason: ${reason}`);
});

log('Backend starting...');
log(`Build Time: 2026-02-17 09:30 UTC`);
log(`CWD: ${process.cwd()}`);
log(`Port: ${env.port}`);

async function start() {
  log('Initializing Fastify...');
  const app = Fastify({ logger: true });

  await app.register(cors, { 
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true
  });

  // Actor context for the change journal.
  //
  // The journal has to record WHO made each change, but mutations are emitted
  // deep in the repository layer, which never sees the caller. Rather than
  // thread an actor argument through forty repository methods and every call
  // site - a large mechanical change to code that currently works - the
  // authenticated caller is stashed in an AsyncLocalStorage for the duration
  // of the request and read by emitOutbox().
  //
  // This hook is deliberately NON-ENFORCING: it never rejects, never replies,
  // and swallows every error. Authorisation stays exactly where it is, in
  // each route's authenticateRequest() call. If this decode fails for any
  // reason the request proceeds untouched and the journal simply records a
  // NULL actor, which is honest. Making it enforcing would put a brand new
  // failure mode in front of every endpoint in the app.
  app.addHook('onRequest', (request, _reply, done) => {
    let actor: { user_id: string | null; role?: string | null; store_id?: string | null } = {
      user_id: null,
    };
    try {
      const header = request.headers.authorization;
      if (header && header.startsWith('Bearer ')) {
        const payload = jwt.verify(header.slice('Bearer '.length), env.jwtSecret) as {
          sub?: string;
          role?: string;
          store_id?: string | null;
        };
        actor = {
          user_id: payload?.sub ?? null,
          role: payload?.role ?? null,
          store_id: payload?.store_id ?? null,
        };
      }
    } catch {
      /* unauthenticated or bad token - the route will deal with it */
    }
    runWithActor(actor, done);
  });

  // Centralized Error Handler
  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid input data.',
        details: error.validation
      });
    }
    
    request.log.error(error);
    reply.status(error.statusCode || 500).send({
      error: error.name || 'InternalServerError',
      message: error.message || 'An unexpected error occurred.'
    });
  });

  app.get('/health', async () => ({
    status: 'ok',
    dataPath: db.dbFile,
  }));

  await registerAuthRoutes(app);
  await registerProductRoutes(app);
  await registerInvitationRoutes(app);
  await registerPurchasingRoutes(app);
  await registerDeliveryRoutes(app);
  await registerTeamRoutes(app);
  await registerSalesRoutes(app);
  await registerStoreRoutes(app);
  await registerClientsRoutes(app);
  await registerSyncRoutes(app);
  await registerAnalyticsRoutes(app);
  await registerAuditRoutes(app);
  await registerCashRoutes(app);
  await registerSystemRoutes(app);

  // Run Startup Scheduler
  try {
    runScheduler();
  } catch (err) {
    log(`Scheduler Error: ${err}`);
  }

  try {
    log(`Attempting to listen on port ${env.port}...`);
    await app.listen({ port: env.port, host: '0.0.0.0' });
    log(`LocalBridge listening on http://localhost:${env.port}`);
    app.log.info(`LocalBridge listening on http://localhost:${env.port}`);
  } catch (err) {
    log(`CRITICAL ERROR during startup: ${err}`);
    app.log.error(err);
    process.exit(1);
  }
}

log('Calling start()...');
start().catch(e => {
  log(`UNHANDLED PROMISE ERROR: ${e}`);
});// Force restart Sun Feb 22 16:14:50 GMT 2026
// Force restart Tue Feb 24 15:46:30 GMT 2026
// Force restart Tue Feb 24 15:50:01 GMT 2026
// Force restart Tue Feb 24 16:01:22 GMT 2026
// Force restart Tue Feb 24 16:04:13 GMT 2026
// Force restart Tue Feb 24 17:06:34 GMT 2026
// Force restart Tue Feb 24 20:40:07 GMT 2026
// Force restart Tue Feb 24 20:59:29 GMT 2026
// Force restart Wed Feb 25 03:42:13 GMT 2026
// Force restart Wed Feb 25 04:04:18 GMT 2026
