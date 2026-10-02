import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { timingSafeEqual } from 'node:crypto';
import type { AdjustRequest, ItemPatch, Location, NewItem, ScanRequest, ScanResult, Settings } from '@pantry/shared';
import { LOCATIONS } from '@pantry/shared';
import type { Db } from './db';
import * as items from './items';
import { ConflictError, NotFoundError } from './items';
import type { ProductLookup } from './lookup';
import { buildShoppingList, toExtra } from './shopping';
import { getSettings, updateSettings } from './settings';

export interface AppOptions {
  db: Db;
  lookup: ProductLookup;
  apiToken?: string | null;
  logger?: boolean;
}

const qty = { type: 'number', minimum: 0 } as const;
const nullableQty = { type: ['number', 'null'], minimum: 0 } as const;
const nullableStr = { type: ['string', 'null'] } as const;
const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1 } },
} as const;

const itemFields = {
  barcode: nullableStr,
  name: { type: 'string', minLength: 1, maxLength: 200 },
  brand: nullableStr,
  location: { type: 'string', enum: LOCATIONS },
  unit: { type: 'string', minLength: 1, maxLength: 32 },
  minQuantity: nullableQty,
  targetQuantity: nullableQty,
  trackShopping: { type: 'boolean' },
  notes: nullableStr,
} as const;

function tokenMatches(header: string | undefined, token: string): boolean {
  const given = Buffer.from(header?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { db, lookup } = opts;
  const app = Fastify({
    logger: opts.logger ?? false,
    ajv: { customOptions: { removeAdditional: 'all', coerceTypes: true } },
  });

  // The desktop app loads from file:// and the dev servers run on other ports, so allow any origin.
  // Access control, if wanted, is the API token.
  await app.register(cors, { origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });

  if (opts.apiToken) {
    const token = opts.apiToken;
    app.addHook('onRequest', async (req, reply) => {
      if (req.method === 'OPTIONS' || req.url === '/api/health') return;
      if (!tokenMatches(req.headers.authorization, token)) {
        return reply.code(401).send({ message: 'Missing or wrong API token' });
      }
    });
  }

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof NotFoundError) return reply.code(404).send({ message: err.message });
    if (err instanceof ConflictError) return reply.code(409).send({ message: err.message });
    const e = err as { validation?: unknown; statusCode?: number; message: string };
    if (e.validation) return reply.code(400).send({ message: e.message });
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ message: e.message });
    app.log.error(err);
    return reply.code(500).send({ message: 'Internal server error' });
  });

  app.get('/api/health', async () => {
    try {
      await db.query('SELECT 1');
      return { ok: true, database: true };
    } catch {
      return { ok: false, database: false };
    }
  });

  // ---- Items ----

  app.get<{ Querystring: { q?: string; location?: Location } }>('/api/items', {
    schema: {
      querystring: {
        type: 'object',
        properties: { q: { type: 'string' }, location: { type: 'string', enum: LOCATIONS } },
      },
    },
  }, async (req) => items.listItems(db, req.query));

  app.post<{ Body: NewItem & { source?: string } }>('/api/items', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: { ...itemFields, quantity: qty, source: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const { source, ...input } = req.body;
    reply.code(201);
    return items.createItem(db, input, source ?? null);
  });

  app.get<{ Params: { id: number } }>('/api/items/:id', { schema: { params: idParams } },
    async (req) => items.getItem(db, req.params.id));

  app.patch<{ Params: { id: number }; Body: ItemPatch }>('/api/items/:id', {
    schema: {
      params: idParams,
      body: {
        type: 'object',
        properties: { ...itemFields, snoozedUntil: { type: ['string', 'null'], format: 'date-time' } },
      },
    },
  }, async (req) => items.updateItem(db, req.params.id, req.body));

  app.delete<{ Params: { id: number } }>('/api/items/:id', { schema: { params: idParams } },
    async (req, reply) => {
      await items.deleteItem(db, req.params.id);
      return reply.code(204).send();
    });

  app.post<{ Params: { id: number }; Body: AdjustRequest }>('/api/items/:id/adjust', {
    schema: {
      params: idParams,
      body: {
        type: 'object',
        properties: { delta: { type: 'number' }, set: qty, source: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const { delta, set, source } = req.body;
    if ((delta === undefined) === (set === undefined)) {
      return reply.code(400).send({ message: 'Send exactly one of delta or set' });
    }
    const change = set !== undefined ? { set } : { delta: delta! };
    const { item } = await items.adjustStock(db, req.params.id, change, set !== undefined ? 'set' : 'adjust', source ?? null);
    return item;
  });

  app.get<{ Params: { id: number } }>('/api/items/:id/events', { schema: { params: idParams } },
    async (req) => items.listEvents(db, req.params.id));

  // ---- Barcodes and scanning ----

  app.get<{ Params: { code: string } }>('/api/barcodes/:code', async (req) => {
    const barcode = req.params.code.trim();
    const item = await items.findByBarcode(db, barcode);
    return { barcode, item, suggestion: item ? null : await lookup(barcode) };
  });

  app.post<{ Body: ScanRequest }>('/api/scan', {
    schema: {
      body: {
        type: 'object',
        required: ['barcode', 'mode'],
        properties: {
          barcode: { type: 'string', minLength: 1 },
          mode: { type: 'string', enum: ['in', 'out'] },
          amount: { type: 'number', exclusiveMinimum: 0 },
          source: { type: 'string' },
        },
      },
    },
  }, async (req): Promise<ScanResult> => {
    const { mode, amount = 1, source } = req.body;
    const barcode = req.body.barcode.trim();
    const existing = await items.findByBarcode(db, barcode);
    if (!existing) {
      return { status: 'unknown', barcode, suggestion: await lookup(barcode) };
    }
    const delta = mode === 'in' ? amount : -amount;
    const { item, event } = await items.adjustStock(
      db, existing.id, { delta }, mode === 'in' ? 'scan_in' : 'scan_out', source ?? null,
    );
    return { status: 'updated', item, event };
  });

  // ---- Shopping list ----

  app.get('/api/shopping-list', async () => buildShoppingList(db));

  app.post<{ Body: { name: string; quantity?: number } }>('/api/shopping-list/extras', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', minLength: 1, maxLength: 200 }, quantity: qty },
      },
    },
  }, async (req, reply) => {
    const { rows } = await db.query(
      'INSERT INTO shopping_extras (name, quantity) VALUES ($1, $2) RETURNING *',
      [req.body.name.trim(), req.body.quantity ?? 1],
    );
    reply.code(201);
    return toExtra(rows[0]);
  });

  app.patch<{ Params: { id: number }; Body: { name?: string; quantity?: number; checked?: boolean } }>(
    '/api/shopping-list/extras/:id', {
      schema: {
        params: idParams,
        body: {
          type: 'object',
          properties: { name: { type: 'string', minLength: 1 }, quantity: qty, checked: { type: 'boolean' } },
        },
      },
    }, async (req) => {
      const { name, quantity, checked } = req.body;
      const { rows } = await db.query(
        `UPDATE shopping_extras SET name = coalesce($1, name), quantity = coalesce($2, quantity),
           checked = coalesce($3, checked) WHERE id = $4 RETURNING *`,
        [name ?? null, quantity ?? null, checked ?? null, req.params.id],
      );
      if (!rows[0]) throw new NotFoundError(`Extra ${req.params.id} not found`);
      return toExtra(rows[0]);
    });

  app.delete<{ Params: { id: number } }>('/api/shopping-list/extras/:id', { schema: { params: idParams } },
    async (req, reply) => {
      const { rowCount } = await db.query('DELETE FROM shopping_extras WHERE id = $1', [req.params.id]);
      if (!rowCount) throw new NotFoundError(`Extra ${req.params.id} not found`);
      return reply.code(204).send();
    });

  app.delete<{ Querystring: { checked?: boolean } }>('/api/shopping-list/extras', {
    schema: { querystring: { type: 'object', properties: { checked: { type: 'boolean' } } } },
  }, async (req, reply) => {
    if (!req.query.checked) return reply.code(400).send({ message: 'Only ?checked=true is supported' });
    await db.query('DELETE FROM shopping_extras WHERE checked');
    return reply.code(204).send();
  });

  // ---- Settings ----

  app.get('/api/settings', async () => getSettings(db));

  app.put<{ Body: Partial<Settings> }>('/api/settings', {
    schema: {
      body: {
        type: 'object',
        properties: {
          defaultMinQuantity: qty,
          lookaheadDays: { type: 'number', minimum: 0, maximum: 365 },
          usageWindowDays: { type: 'number', minimum: 1, maximum: 365 },
        },
      },
    },
  }, async (req) => updateSettings(db, req.body));

  return app;
}
