import type { EventKind, InventoryEvent, Item, ItemPatch, Location, NewItem } from '@pantry/shared';
import type { Db, Queryable } from './db';
import { withTransaction } from './db';

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

const ITEM_COLUMNS = `id, barcode, name, brand, location, unit, quantity, min_quantity, target_quantity,
  track_shopping, snoozed_until, notes, created_at, updated_at`;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toItem(r: any): Item {
  return {
    id: r.id,
    barcode: r.barcode,
    name: r.name,
    brand: r.brand,
    location: r.location,
    unit: r.unit,
    quantity: r.quantity,
    minQuantity: r.min_quantity,
    targetQuantity: r.target_quantity,
    trackShopping: r.track_shopping,
    snoozedUntil: iso(r.snoozed_until),
    notes: r.notes,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

function toEvent(r: any): InventoryEvent {
  return {
    id: r.id,
    itemId: r.item_id,
    delta: r.delta,
    quantityAfter: r.quantity_after,
    kind: r.kind,
    source: r.source,
    createdAt: iso(r.created_at)!,
  };
}

function normBarcode(code: string | null | undefined): string | null {
  const c = code?.trim();
  return c ? c : null;
}

function rethrowUnique(err: unknown): never {
  if ((err as { code?: string }).code === '23505') {
    throw new ConflictError('Another item already uses that barcode');
  }
  throw err;
}

export async function listItems(db: Queryable, filter: { q?: string; location?: Location } = {}): Promise<Item[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.q) {
    params.push(`%${filter.q.toLowerCase()}%`);
    where.push(`(lower(name) LIKE $${params.length} OR lower(coalesce(brand, '')) LIKE $${params.length} OR barcode = $${params.length + 1})`);
    params.push(filter.q);
  }
  if (filter.location) {
    params.push(filter.location);
    where.push(`location = $${params.length}`);
  }
  const sql = `SELECT ${ITEM_COLUMNS} FROM items ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY lower(name)`;
  const { rows } = await db.query(sql, params);
  return rows.map(toItem);
}

export async function getItem(db: Queryable, id: number): Promise<Item> {
  const { rows } = await db.query(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = $1`, [id]);
  if (!rows[0]) throw new NotFoundError(`Item ${id} not found`);
  return toItem(rows[0]);
}

export async function findByBarcode(db: Queryable, barcode: string): Promise<Item | null> {
  const { rows } = await db.query(`SELECT ${ITEM_COLUMNS} FROM items WHERE barcode = $1`, [barcode.trim()]);
  return rows[0] ? toItem(rows[0]) : null;
}

export async function createItem(pool: Db, input: NewItem, source: string | null = null): Promise<Item> {
  return withTransaction(pool, async (c) => {
    let row;
    try {
      ({ rows: [row] } = await c.query(
        `INSERT INTO items (barcode, name, brand, location, unit, quantity, min_quantity, target_quantity, track_shopping, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${ITEM_COLUMNS}`,
        [
          normBarcode(input.barcode),
          input.name.trim(),
          input.brand?.trim() || null,
          input.location ?? 'pantry',
          input.unit?.trim() || 'count',
          input.quantity ?? 0,
          input.minQuantity ?? null,
          input.targetQuantity ?? null,
          input.trackShopping ?? true,
          input.notes ?? null,
        ],
      ));
    } catch (err) {
      rethrowUnique(err);
    }
    const item = toItem(row);
    if (item.quantity > 0) {
      await c.query(
        `INSERT INTO inventory_events (item_id, delta, quantity_after, kind, source) VALUES ($1, $2, $2, 'create', $3)`,
        [item.id, item.quantity, source],
      );
    }
    return item;
  });
}

const PATCH_COLUMNS: Record<string, string> = {
  barcode: 'barcode',
  name: 'name',
  brand: 'brand',
  location: 'location',
  unit: 'unit',
  minQuantity: 'min_quantity',
  targetQuantity: 'target_quantity',
  trackShopping: 'track_shopping',
  snoozedUntil: 'snoozed_until',
  notes: 'notes',
};

/** Edits item details. Quantity changes go through adjustStock so they are logged. */
export async function updateItem(db: Queryable, id: number, patch: ItemPatch): Promise<Item> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(PATCH_COLUMNS)) {
    if (!(key in patch)) continue;
    let value = (patch as Record<string, unknown>)[key];
    if (key === 'barcode') value = normBarcode(value as string | null);
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  if (!sets.length) return getItem(db, id);
  params.push(id);
  try {
    const { rows } = await db.query(
      `UPDATE items SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING ${ITEM_COLUMNS}`,
      params,
    );
    if (!rows[0]) throw new NotFoundError(`Item ${id} not found`);
    return toItem(rows[0]);
  } catch (err) {
    rethrowUnique(err);
  }
}

export async function deleteItem(db: Queryable, id: number): Promise<void> {
  const { rowCount } = await db.query('DELETE FROM items WHERE id = $1', [id]);
  if (!rowCount) throw new NotFoundError(`Item ${id} not found`);
}

export type StockChange = { delta: number } | { set: number };

/** Applies a stock change atomically and logs it. Stock never goes below zero. */
export async function adjustStock(
  pool: Db,
  id: number,
  change: StockChange,
  kind: EventKind,
  source: string | null = null,
): Promise<{ item: Item; event: InventoryEvent }> {
  return withTransaction(pool, async (c) => {
    const { rows: [current] } = await c.query('SELECT quantity FROM items WHERE id = $1 FOR UPDATE', [id]);
    if (!current) throw new NotFoundError(`Item ${id} not found`);
    const before: number = current.quantity;
    const after = 'set' in change ? change.set : Math.max(0, before + change.delta);
    const { rows: [itemRow] } = await c.query(
      `UPDATE items SET quantity = $1, updated_at = now() WHERE id = $2 RETURNING ${ITEM_COLUMNS}`,
      [after, id],
    );
    const { rows: [eventRow] } = await c.query(
      `INSERT INTO inventory_events (item_id, delta, quantity_after, kind, source)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, after - before, after, kind, source],
    );
    return { item: toItem(itemRow), event: toEvent(eventRow) };
  });
}

export async function listEvents(db: Queryable, id: number, limit = 100): Promise<InventoryEvent[]> {
  await getItem(db, id);
  const { rows } = await db.query(
    'SELECT * FROM inventory_events WHERE item_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2',
    [id, limit],
  );
  return rows.map(toEvent);
}
