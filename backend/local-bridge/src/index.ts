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
import { registerSyncRoutes } from './routes/sync.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerAuditRoutes } from './routes/audit.js';
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
    origin: [
      'http://tauri.localhost', 
      'https://tauri.localhost',
      'tauri://localhost',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8787',
      'http://localhost:8787'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true
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
  await registerSyncRoutes(app);
  await registerAnalyticsRoutes(app);
  await registerAuditRoutes(app);

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
});