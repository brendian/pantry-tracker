import { loadConfig } from './config';
import { createPool } from './db';
import { migrate } from './migrate';

const pool = createPool(loadConfig().db);
try {
  const applied = await migrate(pool, console.log);
  console.log(applied.length ? `Done, ${applied.length} applied.` : 'Database is up to date.');
} finally {
  await pool.end();
}
