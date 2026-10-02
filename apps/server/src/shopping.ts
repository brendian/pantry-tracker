import type { Item, Settings, ShoppingExtra, ShoppingList, ShoppingListEntry } from '@pantry/shared';
import type { Queryable } from './db';
import { toItem } from './items';
import { getSettings } from './settings';

const DAY_MS = 86_400_000;
const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/**
 * Decides whether one item belongs on the shopping list.
 * `used` is the stock consumed over the usage window; the window is shortened for items newer than it,
 * so a week-old item isn't treated as if it had a month of history.
 */
export function evaluateItem(item: Item, used: number, settings: Settings, now: Date): ShoppingListEntry | null {
  if (!item.trackShopping) return null;
  if (item.snoozedUntil && new Date(item.snoozedUntil) > now) return null;

  const effectiveMin = item.minQuantity ?? settings.defaultMinQuantity;
  const ageDays = (now.getTime() - new Date(item.createdAt).getTime()) / DAY_MS;
  const windowDays = Math.max(1, Math.min(settings.usageWindowDays, ageDays));
  const dailyUsage = used > 0 ? used / windowDays : 0;
  const projectedQuantity = item.quantity - dailyUsage * settings.lookaheadDays;

  let reason: ShoppingListEntry['reason'];
  if (item.quantity <= effectiveMin) reason = 'below_min';
  else if (projectedQuantity <= effectiveMin) reason = 'forecast';
  else return null;

  const target = item.targetQuantity ?? effectiveMin + 1;
  const suggestedBuy = Math.max(1, Math.ceil(target - Math.max(0, projectedQuantity)));
  const daysUntilMin = dailyUsage > 0 ? Math.max(0, (item.quantity - effectiveMin) / dailyUsage) : null;

  return {
    item,
    reason,
    effectiveMin,
    dailyUsage: round(dailyUsage, 3),
    projectedQuantity: round(projectedQuantity),
    daysUntilMin: daysUntilMin === null ? null : round(daysUntilMin, 1),
    suggestedBuy,
  };
}

export function toExtra(r: any): ShoppingExtra {
  return { id: r.id, name: r.name, quantity: r.quantity, checked: r.checked, createdAt: r.created_at.toISOString() };
}

export async function buildShoppingList(db: Queryable, now = new Date()): Promise<ShoppingList> {
  const settings = await getSettings(db);
  const since = new Date(now.getTime() - settings.usageWindowDays * DAY_MS);
  // Usage counts scan-outs and downward manual adjustments. Stock-take corrections ('set') are excluded,
  // since they usually fix miscounts rather than reflect consumption.
  const { rows } = await db.query(
    `SELECT i.*, coalesce(u.used, 0) AS used
       FROM items i
       LEFT JOIN (
         SELECT item_id, sum(-delta) AS used
           FROM inventory_events
          WHERE delta < 0 AND kind IN ('scan_out', 'adjust') AND created_at >= $1
          GROUP BY item_id
       ) u ON u.item_id = i.id
      WHERE i.track_shopping`,
    [since],
  );
  const entries = rows
    .map((r) => evaluateItem(toItem(r), r.used, settings, now))
    .filter((e): e is ShoppingListEntry => e !== null)
    .sort((a, b) =>
      a.reason === b.reason
        ? (a.daysUntilMin ?? Infinity) - (b.daysUntilMin ?? Infinity) || a.item.name.localeCompare(b.item.name)
        : a.reason === 'below_min' ? -1 : 1,
    );
  const { rows: extraRows } = await db.query('SELECT * FROM shopping_extras ORDER BY checked, created_at');
  return { generatedAt: now.toISOString(), entries, extras: extraRows.map(toExtra) };
}
