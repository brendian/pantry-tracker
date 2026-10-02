import { describe, expect, it } from 'vitest';
import type { Item } from '@pantry/shared';
import { evaluateItem } from '../src/shopping';
import { DEFAULT_SETTINGS } from '../src/settings';

const now = new Date('2026-10-01T12:00:00Z');
const item = (over: Partial<Item> = {}): Item => ({
  id: 1, barcode: '123', name: 'Beans', brand: null, location: 'pantry', unit: 'count',
  quantity: 5, minQuantity: 2, targetQuantity: 6, trackShopping: true, snoozedUntil: null, notes: null,
  createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z', ...over,
});

describe('evaluateItem', () => {
  it('lists items at or below their minimum', () => {
    const e = evaluateItem(item({ quantity: 2 }), 0, DEFAULT_SETTINGS, now);
    expect(e?.reason).toBe('below_min');
    expect(e?.suggestedBuy).toBe(4);
  });

  it('skips items comfortably above the minimum with no usage', () => {
    expect(evaluateItem(item(), 0, DEFAULT_SETTINGS, now)).toBeNull();
  });

  it('forecasts items that will run low within the look-ahead', () => {
    // 15 used over 30 days = 0.5/day; 7-day look-ahead projects 5 - 3.5 = 1.5, below min 2.
    const e = evaluateItem(item(), 15, DEFAULT_SETTINGS, now);
    expect(e?.reason).toBe('forecast');
    expect(e?.dailyUsage).toBe(0.5);
    expect(e?.daysUntilMin).toBe(6);
    expect(e?.suggestedBuy).toBe(5);
  });

  it('shortens the usage window for new items', () => {
    // Created 3 days ago, 3 used: 1/day rather than 0.1/day.
    const e = evaluateItem(item({ createdAt: '2026-09-28T12:00:00Z' }), 3, DEFAULT_SETTINGS, now);
    expect(e?.dailyUsage).toBe(1);
  });

  it('falls back to the global default minimum', () => {
    const e = evaluateItem(item({ quantity: 1, minQuantity: null, targetQuantity: null }), 0, DEFAULT_SETTINGS, now);
    expect(e?.effectiveMin).toBe(1);
    expect(e?.suggestedBuy).toBe(1);
  });

  it('respects snooze and tracking switches', () => {
    expect(evaluateItem(item({ quantity: 0, snoozedUntil: '2026-10-05T00:00:00Z' }), 0, DEFAULT_SETTINGS, now)).toBeNull();
    expect(evaluateItem(item({ quantity: 0, snoozedUntil: '2026-09-30T00:00:00Z' }), 0, DEFAULT_SETTINGS, now)).not.toBeNull();
    expect(evaluateItem(item({ quantity: 0, trackShopping: false }), 0, DEFAULT_SETTINGS, now)).toBeNull();
  });
});
