import Fastify from 'fastify';
import cors from '@fastify/cors';
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
import { db } from './db.js';

async function start() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

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

  try {
    await app.listen({ port: env.port, host: '0.0.0.0' });
    app.log.info(`LocalBridge listening on http://localhost:${env.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
 
 
 
 
 
