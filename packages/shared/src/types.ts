export type Location = 'pantry' | 'fridge' | 'freezer' | 'other';
export const LOCATIONS: Location[] = ['pantry', 'fridge', 'freezer', 'other'];

export type EventKind = 'scan_in' | 'scan_out' | 'adjust' | 'set' | 'create';
export type ScanMode = 'in' | 'out';

export interface Item {
  id: number;
  barcode: string | null;
  name: string;
  brand: string | null;
  location: Location;
  unit: string;
  quantity: number;
  /** Shopping trigger: the item is listed when stock (or forecast stock) is at or below this. Null uses the global default. */
  minQuantity: number | null;
  /** Restock-to level used to suggest how many to buy. Null means min + 1. */
  targetQuantity: number | null;
  trackShopping: boolean;
  snoozedUntil: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewItem {
  barcode?: string | null;
  name: string;
  brand?: string | null;
  location?: Location;
  unit?: string;
  quantity?: number;
  minQuantity?: number | null;
  targetQuantity?: number | null;
  trackShopping?: boolean;
  notes?: string | null;
}

export type ItemPatch = Partial<NewItem> & { snoozedUntil?: string | null };

export interface InventoryEvent {
  id: number;
  itemId: number;
  delta: number;
  quantityAfter: number;
  kind: EventKind;
  source: string | null;
  createdAt: string;
}

export interface ProductSuggestion {
  name: string | null;
  brand: string | null;
  source: string;
}

export interface BarcodeLookup {
  barcode: string;
  item: Item | null;
  suggestion: ProductSuggestion | null;
}

export interface ScanRequest {
  barcode: string;
  mode: ScanMode;
  amount?: number;
  source?: string;
}

export type ScanResult =
  | { status: 'updated'; item: Item; event: InventoryEvent }
  | { status: 'unknown'; barcode: string; suggestion: ProductSuggestion | null };

export interface AdjustRequest {
  /** Add (positive) or remove (negative) stock. */
  delta?: number;
  /** Set an exact count, e.g. after a stock-take. */
  set?: number;
  source?: string;
}

export type ShoppingReason = 'below_min' | 'forecast';

export interface ShoppingListEntry {
  item: Item;
  reason: ShoppingReason;
  effectiveMin: number;
  dailyUsage: number;
  projectedQuantity: number;
  /** Estimated days until stock reaches the minimum; null when there's no recorded usage. */
  daysUntilMin: number | null;
  suggestedBuy: number;
}

export interface ShoppingExtra {
  id: number;
  name: string;
  quantity: number;
  checked: boolean;
  createdAt: string;
}

export interface ShoppingList {
  generatedAt: string;
  entries: ShoppingListEntry[];
  extras: ShoppingExtra[];
}

export interface Settings {
  /** Minimum used for items that don't set their own. */
  defaultMinQuantity: number;
  /** How far ahead to forecast stock when building the shopping list. */
  lookaheadDays: number;
  /** How many days of usage history the forecast averages over. */
  usageWindowDays: number;
}
