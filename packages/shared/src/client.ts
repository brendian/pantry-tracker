import type {
  AdjustRequest, BarcodeLookup, InventoryEvent, Item, ItemPatch, Location, NewItem,
  ScanRequest, ScanResult, Settings, ShoppingExtra, ShoppingList,
} from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export interface ClientOptions {
  /** e.g. http://192.168.1.20:8080 */
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;
}

export function createClient(opts: ClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const doFetch = opts.fetch ?? fetch;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    const res = await doFetch(`${base}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      throw new ApiError(res.status, (data && data.message) || res.statusText, data);
    }
    return data as T;
  }

  const qs = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
    const out = s.toString();
    return out ? `?${out}` : '';
  };

  return {
    health: () => request<{ ok: boolean; database: boolean }>('GET', '/health'),
    listItems: (filter: { q?: string; location?: Location } = {}) =>
      request<Item[]>('GET', `/items${qs(filter)}`),
    getItem: (id: number) => request<Item>('GET', `/items/${id}`),
    createItem: (item: NewItem & { source?: string }) => request<Item>('POST', '/items', item),
    updateItem: (id: number, patch: ItemPatch) => request<Item>('PATCH', `/items/${id}`, patch),
    deleteItem: (id: number) => request<void>('DELETE', `/items/${id}`),
    adjust: (id: number, req: AdjustRequest) => request<Item>('POST', `/items/${id}/adjust`, req),
    events: (id: number) => request<InventoryEvent[]>('GET', `/items/${id}/events`),
    lookupBarcode: (code: string) =>
      request<BarcodeLookup>('GET', `/barcodes/${encodeURIComponent(code)}`),
    scan: (req: ScanRequest) => request<ScanResult>('POST', '/scan', req),
    shoppingList: () => request<ShoppingList>('GET', '/shopping-list'),
    addExtra: (extra: { name: string; quantity?: number }) =>
      request<ShoppingExtra>('POST', '/shopping-list/extras', extra),
    updateExtra: (id: number, patch: Partial<Pick<ShoppingExtra, 'name' | 'quantity' | 'checked'>>) =>
      request<ShoppingExtra>('PATCH', `/shopping-list/extras/${id}`, patch),
    deleteExtra: (id: number) => request<void>('DELETE', `/shopping-list/extras/${id}`),
    clearCheckedExtras: () => request<void>('DELETE', '/shopping-list/extras?checked=true'),
    getSettings: () => request<Settings>('GET', '/settings'),
    updateSettings: (patch: Partial<Settings>) => request<Settings>('PUT', '/settings', patch),
  };
}

export type PantryClient = ReturnType<typeof createClient>;
