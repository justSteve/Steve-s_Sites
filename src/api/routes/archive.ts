/**
 * Archive serving API routes
 * Handles serving archived pages and assets
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import mime from 'mime-types';

const router = Router();

/**
 * Static archive server - Serve archived files with assets
 */
router.get('/:domain/:timestamp/*', (req: Request, res: Response) => {
  const domain = req.params.domain as string;
  const timestamp = req.params.timestamp as string;
  const assetPath = (req.params[0] || 'index.html') as string;

  // Construct full file path
  const filePath = path.join(
    process.cwd(),
    'archived_pages',
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
router.get('/:domain', (req: Request, res: Response) => {
  const domain = req.params.domain as string;
  const domainPath = path.join(process.cwd(), 'archived_pages', domain);

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

export default router;
