/**
 * Domain-related API routes
 * Handles domain lists, statistics, timelines, and snapshots
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

const router = Router();

// Database path
const DB_PATH = path.join(process.cwd(), 'cdx_analysis.db');

/**
 * Get list of all domains
 */
router.get('/domains', (req: Request, res: Response) => {
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
router.get('/domains/:domain', (req: Request, res: Response) => {
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
router.get('/domains/:domain/timeline', (req: Request, res: Response) => {
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
router.get('/domains/:domain/snapshots', (req: Request, res: Response) => {
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

export default router;
