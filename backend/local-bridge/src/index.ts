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

// A stdout/stderr pipe to the Tauri parent process can drop (window backgrounded,
// OS pipe hiccup, quick relaunch) at any moment. When that happens, an ordinary
// console.log/console.error call - and there are hundreds throughout this
// codebase - throws EPIPE with NO listeners on the stream's own 'error' event,
// which Node's EventEmitter then rethrows as an uncaught exception. That hit
// the unconditional process.exit(1) below and killed the entire backend mid
// request (confirmed in the field: crashes inside registerSystemRoutes,
// updateProduct, getStockValuation, auth routes - the DB write had already
// succeeded, only the follow-up log line brought the whole server down).
// Swallowing the stream-level error here stops it from ever reaching
// uncaughtException in the first place.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EPIPE') throw err;
});
process.stderr.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EPIPE') throw err;
});

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

  app.get('/health', async () => {
    // isBootstrapped tells the frontend whether this install has ever had a
    // master account created on it. AuthContext polls THIS endpoint and reads
    // exactly this field (setIsBootstrapped(data.isBootstrapped !== false)),
    // but it was never actually sent - so it read `undefined`, which is
    // `!== false`, so isBootstrapped was pinned to true forever. That made
    // the entire first-run activation UI in AuthPage unreachable dead code:
    // the "Activation de Compte / Internet Requis" header, the "Configuration
    // de Premier Démarrage" panel and the "Activer & Synchroniser" button all
    // render only under `!isBootstrapped`, and signIn()'s
    // runCloudBootstrapFlow() branch is likewise gated on it. Net effect on a
    // fresh install with no local master: the user is shown a plain login
    // form for an account that does not exist locally yet, and the only way
    // it can still work is the online-only cloud fallback - so with Supabase
    // unreachable there is no path at all to a working login, which is
    // exactly the "cannot connect to Supabase OR use the local password"
    // report from the field.
    let isBootstrapped = true;
    try {
      isBootstrapped = !!db.getMasterUser();
    } catch (err) {
      // Keep the previous (always-true) behaviour if the DB can't be read,
      // rather than falsely prompting an activated install to re-activate.
      log(`/health: could not determine bootstrap state: ${err}`);
    }

    return {
      status: 'ok',
      dataPath: db.dbFile,
      isBootstrapped,
    };
  });

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

  // A quick relaunch (app closed and reopened right away) can start this
  // sidecar before the OS has released the previous instance's hold on
  // 8787 - that used to be a hard, immediate crash (EADDRINUSE), confirmed
  // in the field, requiring the user to notice and relaunch a second time.
  // Retry a few times with a short backoff instead of giving up instantly.
  // Bind loopback only, NOT 0.0.0.0. Two reasons, both bad:
  //
  // 1. Listening on a non-loopback interface is what makes Windows pop the
  //    "allow this app to communicate on your network" firewall dialog on
  //    first run. If anyone ever answers Cancel/Block on that dialog (easy to
  //    do - it looks scary and it is not obviously part of the POS), Windows
  //    writes a persistent block rule and then NEVER ASKS AGAIN, it just
  //    silently blocks from then on. That matches the report exactly: the
  //    prompt used to appear, now nothing appears and the bridge is
  //    unreachable. Loopback traffic is never firewalled on Windows, so
  //    binding 127.0.0.1 sidesteps the dialog - and any pre-existing block
  //    rule - entirely.
  // 2. 0.0.0.0 published the whole POS API - auth, sales, the entire local
  //    database - to every device on the same network. On shop or shared
  //    wifi that is a genuine exposure, and nothing needs it: the frontend
  //    only ever talks to 127.0.0.1:8787 (see dataClient.ts, which even
  //    rewrites localhost to 127.0.0.1 explicitly).
  //
  // Still overridable via HOST for anyone who deliberately wants LAN access.
  const bindHost = process.env.HOST || '127.0.0.1';
  const maxListenAttempts = 5;
  for (let attempt = 1; attempt <= maxListenAttempts; attempt++) {
    try {
      log(`Attempting to listen on ${bindHost}:${env.port} (attempt ${attempt}/${maxListenAttempts})...`);
      await app.listen({ port: env.port, host: bindHost });
      log(`LocalBridge listening on http://${bindHost}:${env.port}`);
      app.log.info(`LocalBridge listening on http://${bindHost}:${env.port}`);
      return;
    } catch (err: any) {
      const isPortConflict = err?.code === 'EADDRINUSE';
      if (isPortConflict && attempt < maxListenAttempts) {
        log(`Port ${env.port} still in use (previous instance shutting down?), retrying in 1s...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      log(`CRITICAL ERROR during startup: ${err}`);
      app.log.error(err);
      process.exit(1);
    }
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
