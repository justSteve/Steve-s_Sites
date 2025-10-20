/**
 * Wayback Archive Toolkit API Server
 * Combines shared API infrastructure with domain-specific routes
 */

import { Express } from 'express';
import { createApiServer } from '@myorg/api-server';
import * as path from 'path';
import domainsRouter from './routes/domains';
import logsRouter from './routes/logs';
import archiveRouter from './routes/archive';

// Database path for health check
const DB_PATH = path.join(process.cwd(), 'cdx_analysis.db');

// Create base server with infrastructure (CORS, JSON, health, error handling)
const app: Express = createApiServer({
  dbPath: DB_PATH,
  enableLogging: process.env.NODE_ENV === 'development'
});

// Add WBM-specific routes
app.use('/api', domainsRouter as any);
app.use('/api', logsRouter as any);
app.use('/archive', archiveRouter as any);

/**
 * Start the API server
 */
export function startServer(port: number = 3001): any {
  const server = app.listen(port, () => {
    console.log(`Wayback Archive Toolkit API running on http://localhost:${port}`);
    console.log(`Database: ${DB_PATH}`);
  });
  return server;
}

// Start server if run directly (backwards compatibility)
if (require.main === module) {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
  startServer(PORT);
}

export default app;
