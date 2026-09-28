import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './db/pool';
import { runMigrations } from './db/migrate';

// 1. Configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
  });
});

/**
 * Initializes database connectivity, runs pending migrations, and starts Express HTTP server.
 */
async function startServer(): Promise<void> {
  try {
    // 2. Database Connectivity Check
    console.log('[PhoneMail] Verifying PostgreSQL database connection...');
    await testConnection();
    console.log('[PhoneMail] PostgreSQL database connection verified successfully.');

    // 3. Migration Runner
    console.log('[PhoneMail] Executing database migrations...');
    await runMigrations();
    console.log('[PhoneMail] Database migrations processed successfully.');

    // 4. Start Express Server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[PhoneMail] Express server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('[PhoneMail] Fatal startup error during database initialization:', error);
    // Halt process; do not start HTTP server on failed DB/migration
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
