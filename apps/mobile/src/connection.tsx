import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type PantryClient } from '@pantry/shared';

export interface Connection {
  baseUrl: string;
  token: string;
}

const KEY = 'pantry.connection';

interface Ctx {
  connection: Connection | null;
  api: PantryClient | null;
  save: (c: Connection) => Promise<void>;
  loaded: boolean;
}

const ConnectionContext = createContext<Ctx | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setConnection(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = useCallback(async (c: Connection) => {
    await AsyncStorage.setItem(KEY, JSON.stringify(c));
    setConnection(c);
  }, []);

  const api = useMemo(
    () => (connection?.baseUrl ? createClient({ baseUrl: connection.baseUrl, token: connection.token || undefined }) : null),
    [connection],
  );

  return <ConnectionContext.Provider value={{ connection, api, save, loaded }}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): Ctx {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('ConnectionProvider missing');
  return ctx;
}

/** For screens that only render once a server is configured. */
export function useApi(): PantryClient {
  const { api } = useConnection();
  if (!api) throw new Error('No server configured');
  return api;
}

export function errorMessage(err: unknown): string {
  if (err instanceof TypeError) return 'Could not reach the server. Check the address in Settings and that you are on home Wi-Fi.';
  return err instanceof Error ? err.message : String(err);
}

export { createClient };
