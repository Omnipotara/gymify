import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
  process.exit(1);
});

/** Run a parameterized query. Use this in repositories. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
  // pg's QueryResultRow requires an index signature; we cast so domain types can be used directly
  return (pool as any).query(text, params) as Promise<{ rows: T[]; rowCount: number | null }>;
}
