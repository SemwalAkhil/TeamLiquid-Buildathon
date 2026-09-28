import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { executeMigrations } from './migrate';

test('Migration Runner - executes migrations in order on clean database', async () => {
  const trackingTable = new Set<string>();

  const mockClient = {
    async query(sql: string, params?: any[]) {
      if (sql.includes('SELECT version FROM schema_migrations')) {
        return { rows: Array.from(trackingTable).map((v) => ({ version: v })) };
      }
      if (sql.includes('INSERT INTO schema_migrations')) {
        if (params && params[0]) {
          trackingTable.add(params[0]);
        }
        return { rowCount: 1 };
      }
      return { rows: [] };
    },
  };

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const result = await executeMigrations(mockClient, migrationsDir);

  assert.strictEqual(result.applied.length, 2);
  assert.strictEqual(result.skipped.length, 0);
  assert.ok(trackingTable.has('001_initial_schema.sql'));
  assert.ok(trackingTable.has('002_constraints_and_indexes.sql'));
});

test('Migration Runner - idempotent execution skips previously applied migrations', async () => {
  const trackingTable = new Set<string>([
    '001_initial_schema.sql',
    '002_constraints_and_indexes.sql',
  ]);

  const mockClient = {
    async query(sql: string) {
      if (sql.includes('SELECT version FROM schema_migrations')) {
        return { rows: Array.from(trackingTable).map((v) => ({ version: v })) };
      }
      return { rows: [] };
    },
  };

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const result = await executeMigrations(mockClient, migrationsDir);

  assert.strictEqual(result.applied.length, 0);
  assert.strictEqual(result.skipped.length, 2);
});

test('Migration Runner - rolls back on query failure and throws', async () => {
  let rolledBack = false;
  const mockClient = {
    async query(sql: string) {
      if (sql === 'ROLLBACK') {
        rolledBack = true;
      }
      if (sql.includes('SELECT version FROM schema_migrations')) {
        return { rows: [] };
      }
      if (sql.includes('CREATE TABLE users')) {
        throw new Error('Simulated PostgreSQL syntax error');
      }
      return { rows: [] };
    },
  };

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  await assert.rejects(
    async () => {
      await executeMigrations(mockClient, migrationsDir);
    },
    /Simulated PostgreSQL syntax error/
  );

  assert.strictEqual(rolledBack, true);
});
