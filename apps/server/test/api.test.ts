import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createPool, type Db } from '../src/db';
import { migrate } from '../src/migrate';

// Runs against a real Postgres. Point TEST_DATABASE_URL at a throwaway database: it gets wiped.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('API against Postgres', () => {
  let pool: Db;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = createPool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrate(pool);
    app = await buildApp({
      db: pool,
      lookup: async (code) => (code === '0000111' ? { name: 'Tomato Soup', brand: 'Acme', source: 'test' } : null),
    });
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  const call = async (method: string, url: string, payload?: unknown) => {
    const res = await app.inject({ method: method as any, url, payload: payload as any });
    return { status: res.statusCode, body: res.body ? res.json() : undefined };
  };

  it('reports health', async () => {
    expect((await call('GET', '/api/health')).body).toEqual({ ok: true, database: true });
  });

  it('migrations are idempotent', async () => {
    expect(await migrate(pool)).toEqual([]);
  });

  it('scans an unknown barcode, creates it, then scans in and out', async () => {
    const unknown = await call('POST', '/api/scan', { barcode: '0000111', mode: 'in' });
    expect(unknown.body).toMatchObject({ status: 'unknown', suggestion: { name: 'Tomato Soup' } });

    const created = await call('POST', '/api/items', {
      barcode: '0000111', name: 'Tomato Soup', quantity: 2, minQuantity: 1, targetQuantity: 4,
    });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const dup = await call('POST', '/api/items', { barcode: '0000111', name: 'Dup' });
    expect(dup.status).toBe(409);

    const scanIn = await call('POST', '/api/scan', { barcode: '0000111', mode: 'in', amount: 3 });
    expect(scanIn.body).toMatchObject({ status: 'updated', item: { quantity: 5 }, event: { kind: 'scan_in', delta: 3 } });

    const scanOut = await call('POST', '/api/scan', { barcode: '0000111', mode: 'out', amount: 10 });
    expect(scanOut.body.item.quantity).toBe(0);
    expect(scanOut.body.event.delta).toBe(-5);

    const lookup = await call('GET', '/api/barcodes/0000111');
    expect(lookup.body.item.id).toBe(id);

    const events = await call('GET', `/api/items/${id}/events`);
    expect(events.body.map((e: any) => e.kind)).toEqual(['scan_out', 'scan_in', 'create']);
  });

  it('adjusts and sets stock, and validates the request', async () => {
    const { body: item } = await call('POST', '/api/items', { name: 'Milk', location: 'fridge', unit: 'litre', quantity: 1 });
    expect((await call('POST', `/api/items/${item.id}/adjust`, { delta: 1.5 })).body.quantity).toBe(2.5);
    expect((await call('POST', `/api/items/${item.id}/adjust`, { set: 4 })).body.quantity).toBe(4);
    expect((await call('POST', `/api/items/${item.id}/adjust`, {})).status).toBe(400);
    expect((await call('POST', '/api/items/99999/adjust', { delta: 1 })).status).toBe(404);
  });

  it('edits, filters and deletes items', async () => {
    const { body: item } = await call('POST', '/api/items', { name: 'Frozen Peas', location: 'freezer' });
    const patched = await call('PATCH', `/api/items/${item.id}`, { minQuantity: 2, brand: 'Birds' });
    expect(patched.body).toMatchObject({ minQuantity: 2, brand: 'Birds' });
    const freezer = await call('GET', '/api/items?location=freezer');
    expect(freezer.body.map((i: any) => i.name)).toEqual(['Frozen Peas']);
    const search = await call('GET', '/api/items?q=birds');
    expect(search.body).toHaveLength(1);
    expect((await call('DELETE', `/api/items/${item.id}`)).status).toBe(204);
    expect((await call('GET', `/api/items/${item.id}`)).status).toBe(404);
  });

  it('builds the shopping list from thresholds, usage and extras', async () => {
    await call('PUT', '/api/settings', { lookaheadDays: 7, usageWindowDays: 30, defaultMinQuantity: 1 });
    const { body: rice } = await call('POST', '/api/items', { name: 'Rice', quantity: 10, minQuantity: 2, targetQuantity: 10 });
    // Heavy recent use: 8 used today on a brand-new item, so the forecast drops below min.
    await call('POST', `/api/items/${rice.id}/adjust`, { delta: -5 });
    const { body: oats } = await call('POST', '/api/items', { name: 'Oats', quantity: 9, minQuantity: 1 });
    const { body: snoozed } = await call('POST', '/api/items', { name: 'Snoozed', quantity: 0 });
    await call('PATCH', `/api/items/${snoozed.id}`, { snoozedUntil: new Date(Date.now() + 86_400_000).toISOString() });
    await call('POST', '/api/shopping-list/extras', { name: 'Birthday candles' });

    const { body: list } = await call('GET', '/api/shopping-list');
    const names = list.entries.map((e: any) => e.item.name);
    expect(names).toContain('Tomato Soup'); // 0 left, below min
    expect(names).toContain('Rice'); // forecast
    expect(names).not.toContain('Oats');
    expect(names).not.toContain('Snoozed');
    expect(list.entries[0].reason).toBe('below_min');
    expect(list.entries.find((e: any) => e.item.name === 'Rice').reason).toBe('forecast');
    expect(oats.id).toBeGreaterThan(0);

    expect(list.extras).toHaveLength(1);
    const extraId = list.extras[0].id;
    expect((await call('PATCH', `/api/shopping-list/extras/${extraId}`, { checked: true })).body.checked).toBe(true);
    expect((await call('DELETE', '/api/shopping-list/extras?checked=true')).status).toBe(204);
    expect((await call('GET', '/api/shopping-list')).body.extras).toHaveLength(0);
  });

  it('reads and updates settings', async () => {
    const res = await call('PUT', '/api/settings', { lookaheadDays: 14 });
    expect(res.body).toEqual({ defaultMinQuantity: 1, lookaheadDays: 14, usageWindowDays: 30 });
    expect((await call('PUT', '/api/settings', { usageWindowDays: 0 })).status).toBe(400);
  });
});

describe.skipIf(!url)('API token', () => {
  it('rejects requests without the token but leaves health open', async () => {
    const pool = createPool({ connectionString: url });
    const app = await buildApp({ db: pool, lookup: async () => null, apiToken: 's3cret' });
    expect((await app.inject({ url: '/api/items' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/items', headers: { authorization: 'Bearer s3cret' } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/health' })).statusCode).toBe(200);
    await app.close();
    await pool.end();
  });
});
