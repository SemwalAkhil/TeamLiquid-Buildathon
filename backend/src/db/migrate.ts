import fs from 'fs';
import path from 'path';
import { pool } from './pool';

/**
 * Resolves the directory containing SQL migration files across different runtimes
 * (e.g. tsx development, dist/ in production container, or repository root).
 */
export function getMigrationsDirectory(): string {
  const candidatePaths = [
    path.resolve(__dirname, '../../migrations'),
    path.resolve(__dirname, '../../../migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(process.cwd(), 'backend/migrations'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  throw new Error(
    `Migrations directory not found. Checked candidate paths: ${candidatePaths.join(', ')}`
  );
}

/**
 * Ensures the migration tracking table exists.
 */
async function ensureMigrationTable(client: { query: (sql: string, params?: any[]) => Promise<any> }): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Retrieves the set of already applied migration versions.
 */
async function getAppliedMigrations(client: { query: (sql: string, params?: any[]) => Promise<any> }): Promise<Set<string>> {
  const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY id ASC');
  return new Set(rows.map((row: { version: string }) => row.version));
}

/**
 * Core migration executor accepting a database client and directory path.
 * Can be executed with a live PostgreSQL client or a mock client for unit testing.
 */
export async function executeMigrations(
  client: { query: (sql: string, params?: any[]) => Promise<any> },
  migrationsDir: string
): Promise<{ applied: string[]; skipped: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];

  console.log('[Migrate] Ensuring schema_migrations tracking table exists...');
  await ensureMigrationTable(client);

  const appliedSet = await getAppliedMigrations(client);
  console.log(`[Migrate] Inspecting migration directory: ${migrationsDir}`);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    console.log('[Migrate] No migration files detected.');
    return { applied, skipped };
  }

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`[Migrate] Skipping already applied migration: ${file}`);
      skipped.push(file);
      continue;
    }

    console.log(`[Migrate] Applying pending migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[Migrate] Successfully applied and recorded: ${file}`);
      applied.push(file);
    } catch (migrationError) {
      await client.query('ROLLBACK');
      console.error(`[Migrate] FAILED to execute migration ${file}:`, migrationError);
      throw migrationError;
    }
  }

  console.log(
    `[Migrate] Migration run complete. Applied: ${applied.length}, Skipped: ${skipped.length}`
  );
  return { applied, skipped };
}

/**
 * Runs all pending migrations by acquiring a client from the connection pool.
 */
export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  const client = await pool.connect();
  try {
    const migrationsDir = getMigrationsDirectory();
    return await executeMigrations(client, migrationsDir);
  } finally {
    client.release();
  }
}

// Support direct command-line invocation via `npm run migrate`
if (require.main === module) {
  runMigrations()
    .then(async () => {
      console.log('[Migrate] CLI migration completed successfully.');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Migrate] CLI migration terminated with error:', err);
      await pool.end();
      process.exit(1);
    });
}
