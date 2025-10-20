/**
 * Log file API routes
 * Handles log file listing and content retrieval
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

/**
 * Get available log files
 */
router.get('/logs', (req: Request, res: Response) => {
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
router.get('/logs/:filename', (req: Request, res: Response) => {
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

export default router;
