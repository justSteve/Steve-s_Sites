/**
 * Express API Server for Wayback Archive Frontend
 * Serves domain data, timelines, snapshots, and log files
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import mime from 'mime-types';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database path
const DB_PATH = path.join(process.cwd(), 'cdx_analysis.db');

/**
 * Get list of all domains
 */
app.get('/api/domains', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.json({ domains: [] });
    }

    const db = new Database(DB_PATH, { readonly: true });
    const domains = db.prepare('SELECT DISTINCT domain FROM snapshots ORDER BY domain').all();
    db.close();

    res.json({
      domains: domains.map((row: any) => row.domain),
      count: domains.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get domain summary and statistics
 */
app.get('/api/domains/:domain', (req: Request, res: Response) => {
  try {
    const { domain } = req.params;

    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Database not found' });
    }

    const db = new Database(DB_PATH, { readonly: true });

    // Get domain stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_snapshots,
        MIN(timestamp) as first_snapshot,
        MAX(timestamp) as last_snapshot,
        COUNT(DISTINCT SUBSTR(timestamp, 1, 4)) as years_covered
      FROM snapshots
      WHERE domain = ?
    `).get(domain) as any;

    // Get status code distribution
    const statusCodes = db.prepare(`
      SELECT statuscode, COUNT(*) as count
      FROM snapshots
      WHERE domain = ?
      GROUP BY statuscode
      ORDER BY count DESC
    `).all(domain);

    // Get recent snapshots
    const recentSnapshots = db.prepare(`
      SELECT timestamp, url, statuscode, mimetype, digest, change_score
      FROM snapshots
      WHERE domain = ?
      ORDER BY timestamp DESC
      LIMIT 10
    `).all(domain);

    db.close();

    res.json({
      domain,
      stats,
      statusCodes,
      recentSnapshots
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get timeline data for a domain
 */
app.get('/api/domains/:domain/timeline', (req: Request, res: Response) => {
  try {
    const { domain } = req.params;

    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Database not found' });
    }

    const db = new Database(DB_PATH, { readonly: true });

    const snapshots = db.prepare(`
      SELECT
        timestamp,
        url,
        statuscode,
        mimetype,
        digest,
        change_score,
        SUBSTR(timestamp, 1, 4) as year
      FROM snapshots
      WHERE domain = ?
      ORDER BY timestamp ASC
    `).all(domain);

    db.close();

    // Group by year
    const timelineByYear: Record<string, any[]> = {};
    snapshots.forEach((snap: any) => {
      if (!timelineByYear[snap.year]) {
        timelineByYear[snap.year] = [];
      }
      timelineByYear[snap.year].push(snap);
    });

    res.json({
      domain,
      timeline: timelineByYear,
      totalSnapshots: snapshots.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all snapshots for a domain
 */
app.get('/api/domains/:domain/snapshots', (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const { limit = 100, offset = 0, year } = req.query;

    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Database not found' });
    }

    const db = new Database(DB_PATH, { readonly: true });

    let query = `
      SELECT
        timestamp, url, statuscode, mimetype, digest, change_score
      FROM snapshots
      WHERE domain = ?
    `;

    const params: any[] = [domain];

    if (year) {
      query += ` AND timestamp LIKE ?`;
      params.push(`${year}%`);
    }

    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const snapshots = db.prepare(query).all(...params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM snapshots WHERE domain = ?';
    const countParams: any[] = [domain];
    if (year) {
      countQuery += ' AND timestamp LIKE ?';
      countParams.push(`${year}%`);
    }

    const { total } = db.prepare(countQuery).get(...countParams) as any;

    db.close();

    res.json({
      domain,
      snapshots,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available log files
 */
app.get('/api/logs', (req: Request, res: Response) => {
  try {
    const logFiles: string[] = [];
    const extensions = ['.log'];

    // Search for log files in common locations
    const searchDirs = [
      process.cwd(),
      path.join(process.cwd(), 'logs'),
    ];

    searchDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          if (extensions.some(ext => file.endsWith(ext))) {
            logFiles.push(path.join(dir, file));
          }
        });
      }
    });

    const logFilesWithStats = logFiles.map(filePath => {
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        modified: stats.mtime
      };
    });

    res.json({ logs: logFilesWithStats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get log file contents
 */
app.get('/api/logs/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const { lines = 100, offset = 0 } = req.query;

    // Search for the log file
    const searchDirs = [
      process.cwd(),
      path.join(process.cwd(), 'logs'),
    ];

    let logFilePath: string | null = null;
    for (const dir of searchDirs) {
      const candidatePath = path.join(dir, filename);
      if (fs.existsSync(candidatePath)) {
        logFilePath = candidatePath;
        break;
      }
    }

    if (!logFilePath) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    // Read log file
    const content = fs.readFileSync(logFilePath, 'utf-8');
    const allLines = content.split('\n');

    const startIndex = Number(offset);
    const endIndex = startIndex + Number(lines);
    const selectedLines = allLines.slice(startIndex, endIndex);

    res.json({
      filename,
      lines: selectedLines,
      totalLines: allLines.length,
      offset: startIndex,
      hasMore: endIndex < allLines.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Static archive server - Serve archived files with assets
 */
app.get('/archive/:domain/:timestamp/*', (req: Request, res: Response) => {
  const { domain, timestamp } = req.params;
  const assetPath = req.params[0] || 'index.html';

  // Construct full file path
  const filePath = path.join(
    __dirname,
    '../../archived_pages',
    domain,
    timestamp,
    assetPath
  );

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  // Determine MIME type
  const mimeType = mime.lookup(filePath) || 'application/octet-stream';

  // Set proper headers
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Access-Control-Allow-Origin', '*'); // For iframe embedding

  // Stream file
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

/**
 * List available snapshots for a domain
 */
app.get('/archive/:domain', (req: Request, res: Response) => {
  const { domain } = req.params;
  const domainPath = path.join(__dirname, '../../archived_pages', domain);

  if (!fs.existsSync(domainPath)) {
    return res.status(404).json({ error: 'Domain not found' });
  }

  try {
    const timestamps = fs.readdirSync(domainPath)
      .filter(t => fs.statSync(path.join(domainPath, t)).isDirectory());

    const snapshots = timestamps.map(timestamp => {
      const manifestPath = path.join(domainPath, timestamp, 'manifest.json');
      let manifest = null;

      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      }

      return {
        timestamp,
        url: `/archive/${domain}/${timestamp}/`,
        manifest,
      };
    });

    res.json({
      domain,
      snapshots,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: fs.existsSync(DB_PATH)
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

export default app;
