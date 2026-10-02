import { createContext, useContext } from 'react';
import { createClient, type PantryClient } from '@pantry/shared';

export interface Connection {
  baseUrl: string;
  token: string;
}

const KEY = 'pantry.connection';

export function loadConnection(): Connection {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved?.baseUrl) return { baseUrl: saved.baseUrl, token: saved.token ?? '' };
  } catch {
    // fall through to the default
  }
  return { baseUrl: 'http://localhost:8080', token: '' };
}

export function saveConnection(c: Connection) {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export function clientFor(c: Connection): PantryClient {
  return createClient({ baseUrl: c.baseUrl, token: c.token || undefined });
}

export const ApiContext = createContext<PantryClient | null>(null);

export function useApi(): PantryClient {
  const api = useContext(ApiContext);
  if (!api) throw new Error('ApiContext missing');
  return api;
}

export function errorMessage(err: unknown): string {
  if (err instanceof TypeError) return 'Could not reach the server. Check the address in Settings.';
  return err instanceof Error ? err.message : String(err);
}
