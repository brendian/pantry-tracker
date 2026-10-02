import type { ProductSuggestion } from '@pantry/shared';

export type ProductLookup = (barcode: string) => Promise<ProductSuggestion | null>;

export const noLookup: ProductLookup = async () => null;

/** Looks up a product name on Open Food Facts. Failures are swallowed: a missing name never blocks a scan. */
export function openFoodFactsLookup(timeoutMs = 4000): ProductLookup {
  return async (barcode) => {
    if (!/^\d{6,14}$/.test(barcode)) return null;
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands`,
        { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'PantryTracker/0.1 (self-hosted)' } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { status?: number; product?: { product_name?: string; brands?: string } };
      if (data.status !== 1 || !data.product) return null;
      const name = data.product.product_name?.trim() || null;
      const brand = data.product.brands?.split(',')[0]?.trim() || null;
      if (!name && !brand) return null;
      return { name, brand, source: 'openfoodfacts' };
    } catch {
      return null;
    }
  };
}
