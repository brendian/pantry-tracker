import { buildApp } from './app';
import { loadConfig } from './config';
import { createPool } from './db';
import { noLookup, openFoodFactsLookup } from './lookup';
import { migrate } from './migrate';

const config = loadConfig();
const pool = createPool(config.db);

await migrate(pool, (msg) => console.log(msg));

const app = await buildApp({
  db: pool,
  lookup: config.productLookup ? openFoodFactsLookup() : noLookup,
  apiToken: config.apiToken,
  logger: true,
});

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: config.host, port: config.port });
if (!config.apiToken) app.log.warn('API_TOKEN is not set: anyone on your network can use the API');
