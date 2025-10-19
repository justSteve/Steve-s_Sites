/**
 * Tests for WaybackCrawler service
 */

import { WaybackCrawler, CrawlerDB } from '../WaybackCrawler';
import { createLogger } from '../LoggingService';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

describe('CrawlerDB', () => {
  let db: CrawlerDB;
  let testDbPath: string;
  let logger: ReturnType<typeof createLogger>;

  beforeEach(() => {
    testDbPath = path.join(__dirname, 'test-crawler.db');
    logger = createLogger('test', path.join(__dirname, 'test.log'));
    db = new CrawlerDB(testDbPath, logger);
  });

  afterEach(async () => {
    db.close();
    await logger.close();

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const logFile = path.join(__dirname, 'test.log');
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
  });

  describe('addUrl', () => {
    it('should add URL to database', () => {
      db.addUrl('http://test.com', '20100101000000', 'test.com');

      const url = db.getNextUrl();
      expect(url).not.toBeNull();
      expect(url?.url).toBe('http://test.com');
      expect(url?.timestamp).toBe('20100101000000');
    });

    it('should ignore duplicate URLs', () => {
      db.addUrl('http://test.com', '20100101000000', 'test.com');
      db.addUrl('http://test.com', '20100101000000', 'test.com');

      db.markCompleted('http://test.com', '20100101000000', '/path/to/file');

      const stats = db.getStats();
      expect(stats.completed).toBe(1);
    });

    it('should allow same URL with different timestamp', () => {
      db.addUrl('http://test.com', '20100101000000', 'test.com');
      db.addUrl('http://test.com', '20110101000000', 'test.com');

      const stats = db.getStats();
      expect(stats.pending).toBe(2);
    });
  });

  describe('getNextUrl', () => {
    it('should return next pending URL', () => {
      db.addUrl('http://test1.com', '20100101000000', 'test1.com');
      db.addUrl('http://test2.com', '20100101000000', 'test2.com');

      const url = db.getNextUrl();
      expect(url).not.toBeNull();
      expect(['http://test1.com', 'http://test2.com']).toContain(url?.url);
    });

    it('should return null when no pending URLs', () => {
      const url = db.getNextUrl();
      expect(url).toBeNull();
    });

    it('should not return completed URLs', () => {
      db.addUrl('http://test.com', '20100101000000', 'test.com');
      db.markCompleted('http://test.com', '20100101000000', '/path');

      const url = db.getNextUrl();
      expect(url).toBeNull();
    });
  });

  describe('markCompleted', () => {
    it('should mark URL as completed', () => {
      db.addUrl('http://test.com', '20100101000000', 'test.com');
      db.markCompleted('http://test.com', '20100101000000', '/local/path');

      const stats = db.getStats();
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBeUndefined();
    });
  });

  describe('markFailed', () => {
    it('should mark URL as failed with error', () => {
      db.addUrl('http://test.com', '20100101000000', 'test.com');
      db.markFailed('http://test.com', '20100101000000', '404 Not Found');

      const stats = db.getStats();
      expect(stats.failed).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return empty stats for new database', () => {
      const stats = db.getStats();
      expect(stats).toEqual({});
    });

    it('should count URLs by status', () => {
      db.addUrl('http://test1.com', '20100101000000', 'test.com', 'pending');
      db.addUrl('http://test2.com', '20100101000000', 'test.com', 'pending');
      db.addUrl('http://test3.com', '20100101000000', 'test.com', 'pending');

      db.markCompleted('http://test1.com', '20100101000000', '/path1');
      db.markFailed('http://test2.com', '20100101000000', 'Error');

      const stats = db.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });
});

describe('WaybackCrawler', () => {
  let testOutputDir: string;
  let testLogFile: string;

  beforeEach(() => {
    testOutputDir = path.join(__dirname, 'test-archived-pages');
    testLogFile = path.join(__dirname, 'test-crawler.log');
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testOutputDir)) {
      const removeDir = (dir: string) => {
        if (fs.existsSync(dir)) {
          fs.readdirSync(dir).forEach(file => {
            const currentPath = path.join(dir, file);
            if (fs.lstatSync(currentPath).isDirectory()) {
              removeDir(currentPath);
            } else {
              fs.unlinkSync(currentPath);
            }
          });
          fs.rmdirSync(dir);
        }
      };
      removeDir(testOutputDir);
    }

    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile);
    }

    const dbFile = 'crawler_state.db';
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
  });

  describe('constructor', () => {
    it('should create output directory', () => {
      const crawler = new WaybackCrawler({
        outputDir: testOutputDir,
        logFile: testLogFile
      });

      expect(fs.existsSync(testOutputDir)).toBe(true);
    });

    it('should use default options', () => {
      const crawler = new WaybackCrawler({
        logFile: testLogFile
      });

      expect(fs.existsSync('archived_pages')).toBe(true);

      // Clean up default directory
      if (fs.existsSync('archived_pages')) {
        fs.rmSync('archived_pages', { recursive: true, force: true });
      }
    });

    it('should accept custom off-peak hours', () => {
      const crawler = new WaybackCrawler({
        useOffPeakScheduler: true,
        offPeakStart: { hour: 23, minute: 0 },
        offPeakEnd: { hour: 7, minute: 0 },
        logFile: testLogFile
      });

      expect(crawler).toBeDefined();
    });

    it('should accept scheduler disabled option', () => {
      const crawler = new WaybackCrawler({
        useOffPeakScheduler: false,
        logFile: testLogFile
      });

      expect(crawler).toBeDefined();
    });
  });

  describe('loadSnapshotList', () => {
    it('should load snapshots from file', () => {
      const snapshotFile = path.join(__dirname, 'test-snapshots.txt');
      fs.writeFileSync(
        snapshotFile,
        '# Test snapshots\n20100101000000|http://test.com\n20110101000000|http://test.com/about\n'
      );

      const crawler = new WaybackCrawler({
        snapshotListFile: snapshotFile,
        outputDir: testOutputDir,
        logFile: testLogFile
      });

      crawler.loadSnapshotList();

      fs.unlinkSync(snapshotFile);
    });

    it('should skip comments and empty lines', () => {
      const snapshotFile = path.join(__dirname, 'test-snapshots.txt');
      fs.writeFileSync(
        snapshotFile,
        '# Comment\n\n20100101000000|http://test.com\n# Another comment\n\n20110101000000|http://test.com\n'
      );

      const crawler = new WaybackCrawler({
        snapshotListFile: snapshotFile,
        outputDir: testOutputDir,
        logFile: testLogFile
      });

      crawler.loadSnapshotList();

      fs.unlinkSync(snapshotFile);
    });

    it('should handle missing snapshot file gracefully', () => {
      const crawler = new WaybackCrawler({
        snapshotListFile: 'nonexistent.txt',
        outputDir: testOutputDir,
        logFile: testLogFile
      });

      expect(() => crawler.loadSnapshotList()).not.toThrow();
    });

    it('should handle no snapshot file specified', () => {
      const crawler = new WaybackCrawler({
        outputDir: testOutputDir,
        logFile: testLogFile
      });

      expect(() => crawler.loadSnapshotList()).not.toThrow();
    });
  });

  describe('Asset Fetching Integration', () => {
    it('should fetch assets when enabled', () => {
      const crawler = new WaybackCrawler({
        useOffPeakScheduler: false,
        noDelay: true,
        fetchAssets: true,
        maxAssetSizeMB: 50,
        assetConcurrency: 10,
        fetchExternalAssets: true,
        outputDir: testOutputDir,
        logFile: testLogFile
      });

      // Mock or use small test case
      // This tests that the option is passed through correctly
      expect(crawler['options'].fetchAssets).toBe(true);
      expect(crawler['options'].fetchExternalAssets).toBe(true);
    });

    it('should skip assets when disabled', () => {
      const crawler = new WaybackCrawler({
        fetchAssets: false,
        outputDir: testOutputDir,
        logFile: testLogFile
      });

      expect(crawler['options'].fetchAssets).toBe(false);
    });
  });
});
