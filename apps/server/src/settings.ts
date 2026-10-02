import type { Settings } from '@pantry/shared';
import type { Queryable } from './db';

export const DEFAULT_SETTINGS: Settings = {
  defaultMinQuantity: 1,
  lookaheadDays: 7,
  usageWindowDays: 30,
};

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

export async function getSettings(db: Queryable): Promise<Settings> {
  const { rows } = await db.query<{ key: string; value: unknown }>('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if ((KEYS as string[]).includes(key) && typeof value === 'number') out[key as keyof Settings] = value;
  }
  return out;
}

export async function updateSettings(db: Queryable, patch: Partial<Settings>): Promise<Settings> {
  for (const key of KEYS) {
    if (patch[key] === undefined) continue;
    await db.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(patch[key])],
    );
  }
  return getSettings(db);
}
