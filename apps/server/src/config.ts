import type { PoolConfig } from 'pg';

export interface Config {
  host: string;
  port: number;
  apiToken: string | null;
  productLookup: boolean;
  db: PoolConfig;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // node-postgres reads PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE and PGSSLMODE on its own,
  // so we only need to pass DATABASE_URL through when it's set.
  const db: PoolConfig = env.DATABASE_URL ? { connectionString: env.DATABASE_URL } : {};
  db.max = Number(env.PGPOOL_MAX ?? 10);
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 8080),
    apiToken: env.API_TOKEN?.trim() || null,
    productLookup: (env.PRODUCT_LOOKUP ?? 'true').toLowerCase() !== 'false',
    db,
  };
}
