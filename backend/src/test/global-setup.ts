import path from 'path';
import { Client } from 'pg';

const TEST_DB_URL = 'postgres://gymify_test:gymify_test@localhost:5433/gymify_test';

export async function setup() {
  // Verify the test database is reachable before running migrations
  const client = new Client({ connectionString: TEST_DB_URL });
  try {
    await client.connect();
    await client.end();
  } catch (err) {
    throw new Error(
      `Cannot connect to test database. Is postgres-test running? Start it with:\n  docker compose up -d postgres-test\n\nOriginal error: ${err}`,
    );
  }

  // Apply any pending migrations via the programmatic API (idempotent)
  const { default: migrate } = await import('node-pg-migrate');
  await migrate({
    databaseUrl: TEST_DB_URL,
    migrationsTable: 'pgmigrations',
    dir: path.join(process.cwd(), 'migrations'),
    direction: 'up',
    log: () => {},
    noLock: false,
    checkOrder: false,
  });
}

export async function teardown() {
  // Migrations stay in place; each test file cleans its own data via truncation
}
