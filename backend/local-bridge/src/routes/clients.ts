import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const listSchema = z.object({
  store_id: z.string().optional(),
});

const clientCreateSchema = z.object({
  store_id: z.string().optional(),
  name: z.string().min(1),
  code: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  credit_limit: z.number().nullable().optional(),
  service_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  balance: z.number().optional(),
});

const clientUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  credit_limit: z.number().nullable().optional(),
  service_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  balance: z.number().optional(), // In case needed, though payments handle it
});

const clientServiceCreateSchema = z.object({
  store_id: z.string().optional(),
  name: z.string().min(1),
  default_discount_percent: z.number().min(0).max(100).optional(),
  description: z.string().nullable().optional(),
});

const clientServiceUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  default_discount_percent: z.number().min(0).max(100).optional(),
  description: z.string().nullable().optional(),
});

const clientPaymentSchema = z.object({
  client_id: z.string().min(1),
  amount: z.number().min(0.01),
  payment_method: z.string().optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function registerClientsRoutes(app: FastifyInstance) {
  // --- Clients ---

  app.get('/rest/v1/clients', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    let storeId = parsed.data.store_id;
    
    // Workers can only see their own store
    if (claims.role !== 'master') {
      if (storeId && storeId !== claims.store_id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access to other stores denied.' });
      }
      storeId = claims.store_id || undefined;
    }

    const clients = db.listClients(storeId);
    return reply.send(clients);
  });

  app.get('/rest/v1/clients/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const id = (request.params as { id: string }).id;
    const client = db.getClientById(id);

    if (!client) {
      return reply.status(404).send({ error: 'NotFound', message: 'Client not found.' });
    }

    // Auth check
    if (claims.role !== 'master' && claims.store_id && client.store_id !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied.' });
    }

    return reply.send(client);
  });

  app.post('/rest/v1/clients', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = clientCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    if (claims.role !== 'master' && storeId !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot create client in another store.' });
    }

    const now = new Date().toISOString();
    const clientId = crypto.randomUUID();

    db.insertClient({
      id: clientId,
      store_id: storeId,
      name: parsed.data.name,
      code: parsed.data.code ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      address: parsed.data.address ?? null,
      credit_limit: parsed.data.credit_limit ?? 0,
      current_balance: parsed.data.balance ?? 0,
      service_id: parsed.data.service_id ?? null,
      loyalty_points: 0,
      notes: parsed.data.notes ?? null,
      created_at: now,
      updated_at: now,
    });

    return reply.status(201).send(db.getClientById(clientId));
  });

  app.patch('/rest/v1/clients/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const id = (request.params as { id: string }).id;
    const existing = db.getClientById(id);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Client not found.' });
    }

    if (claims.role !== 'master' && claims.store_id && existing.store_id !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied.' });
    }

    const parsed = clientUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const updated = db.updateClient(id, {
      ...parsed.data,
      current_balance: parsed.data.balance, // map balance to current_balance
      updated_at: new Date().toISOString(),
    });

    return reply.send(updated);
  });

  app.delete('/rest/v1/clients/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const id = (request.params as { id: string }).id;
    const existing = db.getClientById(id);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Client not found.' });
    }

    db.deleteClient(id);
    return reply.send({ message: 'Client deleted.' });
  });

  // --- Client Services (Groups) ---

  app.get('/rest/v1/client_services', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    let storeId = parsed.data.store_id;
    
    if (claims.role !== 'master') {
      if (storeId && storeId !== claims.store_id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access to other stores denied.' });
      }
      storeId = claims.store_id || undefined;
    }

    if (!storeId) {
        // Master requesting all?
        return reply.send(db.listClientServices());
    }

    let services = db.listClientServices(storeId);

    // Auto-seed default groups if empty (Phase 6 requirement, doing it now)
    if (services.length === 0) {
      const now = new Date().toISOString();
      const defaults = [
        { id: crypto.randomUUID(), store_id: storeId, name: 'VIP', default_discount_percent: 10, description: null, created_at: now, updated_at: now },
        { id: crypto.randomUUID(), store_id: storeId, name: 'Grossiste', default_discount_percent: 15, description: null, created_at: now, updated_at: now },
        { id: crypto.randomUUID(), store_id: storeId, name: 'Public', default_discount_percent: 0, description: null, created_at: now, updated_at: now },
      ];
      defaults.forEach(s => db.insertClientService(s));
      services = db.listClientServices(storeId);
    }

    return reply.send(services);
  });

  app.get('/rest/v1/client_services/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const id = (request.params as { id: string }).id;
    const service = db.getClientServiceById(id);

    if (!service) {
      return reply.status(404).send({ error: 'NotFound', message: 'Service not found.' });
    }

    if (claims.role !== 'master' && claims.store_id && service.store_id !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied.' });
    }

    return reply.send(service);
  });

  app.post('/rest/v1/client_services', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = clientServiceCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    if (claims.role !== 'master' && storeId !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot create service in another store.' });
    }

    const now = new Date().toISOString();
    const serviceId = crypto.randomUUID();

    db.insertClientService({
      id: serviceId,
      store_id: storeId,
      name: parsed.data.name,
      default_discount_percent: parsed.data.default_discount_percent ?? 0,
      description: parsed.data.description ?? null,
      created_at: now,
      updated_at: now,
    });

    return reply.status(201).send(db.getClientServiceById(serviceId));
  });

  app.patch('/rest/v1/client_services/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const id = (request.params as { id: string }).id;
    const existing = db.getClientServiceById(id);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Service not found.' });
    }

    if (claims.role !== 'master' && claims.store_id && existing.store_id !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied.' });
    }

    const parsed = clientServiceUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const updated = db.updateClientService(id, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });

    return reply.send(updated);
  });

  app.delete('/rest/v1/client_services/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const id = (request.params as { id: string }).id;
    const existing = db.getClientServiceById(id);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Service not found.' });
    }

    db.deleteClientService(id);
    return reply.send({ message: 'Service deleted.' });
  });

  // --- Client Payments ---

  app.post('/rest/v1/client_payments', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = clientPaymentSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const client = db.getClientById(parsed.data.client_id);
    if (!client) {
      return reply.status(404).send({ error: 'NotFound', message: 'Client not found.' });
    }

    if (claims.role !== 'master' && claims.store_id && client.store_id !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied.' });
    }

    // Record payment (reduces balance)
    // Note: We might want to store a transaction record later, but for now just update balance as requested
    db.updateClientBalance(client.id, -parsed.data.amount);

    return reply.send(db.getClientById(client.id));
  });
}
