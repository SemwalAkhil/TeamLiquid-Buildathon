import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const poolConfig: PoolConfig = connectionString
  ? {
      connectionString,
      max: process.env.PG_MAX_POOL ? parseInt(process.env.PG_MAX_POOL, 10) : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.POSTGRES_HOST || 'postgres',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
      database: process.env.POSTGRES_DB || 'phonemail',
      user: process.env.POSTGRES_USER || 'phonemail',
      password: process.env.POSTGRES_PASSWORD || 'phonemail_dev',
      max: process.env.PG_MAX_POOL ? parseInt(process.env.PG_MAX_POOL, 10) : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err: Error) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err);
});

/**
 * Executes a SQL query with parameters against the connection pool.
 */
export async function query<T = any>(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    console.log('[SQL]', { text, duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Validates connection to the database by acquiring a client and executing a test query.
 */
export async function testConnection(): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

/**
 * Closes the pool and releases all database connections.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
