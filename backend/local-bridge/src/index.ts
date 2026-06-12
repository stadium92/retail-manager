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

  app.get('/health', async () => ({
    status: 'ok',
    dataPath: db.dbFile,
    isBootstrapped: !!db.getMasterUser(),
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

// Force restart 2026-03-07T01:53:43.453Z

// Force backend restart for 100-year session fix: 2026-03-07T11:54:43.936Z
// Force backend restart: Thu Jun 11 11:03:00 UTC 2026
// Force restart for WAL mode performance fix: 2026-06-12T09:50:30Z
// Force restart for Hard Deletion & Store Sync: 2026-06-12T10:04:00Z
// Force restart for Hard Deletion & Store Sync: 2026-06-12T10:04:00Z
// Build retry timestamp: Thu Mar 12 10:32:48 UTC 2026
// Force restart: 2026-06-11T10:49:15Z
// Force restart for sync filter fix: 2026-06-12T09:27:10Z
