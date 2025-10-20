/**
 * Database service for managing SQLite database operations
 * Provides type-safe access to CDX analysis and crawler state
 */

import Database from 'better-sqlite3';
import { Snapshot, DomainStats, YearlyStats, CrawlerURL, CrawlerStats } from '../domain/models/types';
import { LoggingService } from './LoggingService';

/**
 * DatabaseService handles all SQLite database operations
 * with comprehensive error handling and logging
 */
export class DatabaseService {
  private db: Database.Database;
  private logger: LoggingService;
  private dbPath: string;

  /**
   * Creates a new DatabaseService instance
   * @param dbPath - Path to the SQLite database file
   * @param logger - LoggingService instance for error logging
   */
  constructor(dbPath: string, logger: LoggingService) {
    this.dbPath = dbPath;
    this.logger = logger;

    try {
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL'); // Better concurrency
      this.logger.info(`Database opened: ${dbPath}`);
    } catch (error) {
      this.logger.error(`Failed to open database: ${dbPath}`, error as Error);
      throw error;
    }
  }

  /**
   * Initialize the database schema for CDX analysis
   */
  initCDXSchema(): void {
    try {
      this.logger.debug('Initializing CDX analysis schema');

      // Domains table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS domains (
          domain TEXT PRIMARY KEY,
          first_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_analyzed TIMESTAMP,
          total_snapshots INTEGER,
          unique_content_versions INTEGER,
          date_range_start TEXT,
          date_range_end TEXT,
          notes TEXT
        )
      `);

      // Snapshots table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain TEXT NOT NULL,
          url TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          year INTEGER NOT NULL,
          statuscode TEXT NOT NULL,
          mimetype TEXT NOT NULL,
          digest TEXT NOT NULL,
          length INTEGER NOT NULL,
          is_unique_content BOOLEAN NOT NULL,
          is_significant_change BOOLEAN NOT NULL,
          change_score REAL NOT NULL,
          FOREIGN KEY (domain) REFERENCES domains(domain)
        )
      `);

      // Create indexes for performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_domain ON snapshots(domain);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON snapshots(timestamp);
        CREATE INDEX IF NOT EXISTS idx_digest ON snapshots(digest);
        CREATE INDEX IF NOT EXISTS idx_year ON snapshots(year);
      `);

      this.logger.info('CDX schema initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize CDX schema', error as Error);
      throw error;
    }
  }

  /**
   * Initialize the database schema for crawler state
   */
  initCrawlerSchema(): void {
    try {
      this.logger.debug('Initializing crawler state schema');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS urls (
          url TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          domain TEXT NOT NULL,
          status TEXT NOT NULL,
          local_path TEXT,
          discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          fetched_at TIMESTAMP,
          error TEXT,
          PRIMARY KEY (url, timestamp)
        );

        CREATE TABLE IF NOT EXISTS crawler_state (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      this.logger.info('Crawler schema initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize crawler schema', error as Error);
      throw error;
    }
  }

  /**
   * Initialize the database schema for asset deduplication
   */
  initAssetsSchema(): void {
    try {
      this.logger.debug('Initializing assets deduplication schema');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wayback_url TEXT UNIQUE NOT NULL,
          original_url TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          file_path TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          mime_type TEXT,
          first_downloaded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          download_count INTEGER DEFAULT 1,
          domain TEXT,
          timestamp TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_assets_wayback_url ON assets(wayback_url);
        CREATE INDEX IF NOT EXISTS idx_assets_content_hash ON assets(content_hash);
        CREATE INDEX IF NOT EXISTS idx_assets_original_url ON assets(original_url);
      `);

      this.logger.info('Assets schema initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize assets schema', error as Error);
      throw error;
    }
  }

  /**
   * Save a snapshot to the database
   * @param snapshot - Snapshot data to save
   */
  saveSnapshot(snapshot: Snapshot): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO snapshots (
          domain, url, timestamp, year, statuscode, mimetype, digest, length,
          is_unique_content, is_significant_change, change_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        snapshot.domain,
        snapshot.url,
        snapshot.timestamp,
        snapshot.year,
        snapshot.statuscode,
        snapshot.mimetype,
        snapshot.digest,
        snapshot.length,
        snapshot.isUniqueContent ? 1 : 0,
        snapshot.isSignificantChange ? 1 : 0,
        snapshot.changeScore
      );
    } catch (error) {
      this.logger.error('Failed to save snapshot', error as Error, {
        domain: snapshot.domain,
        timestamp: snapshot.timestamp,
      });
      throw error;
    }
  }

  /**
   * Update domain statistics
   * @param domain - Domain name
   * @param stats - Statistics to update
   */
  updateDomainStats(domain: string, stats: Partial<DomainStats>): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO domains (
          domain, last_analyzed, total_snapshots, unique_content_versions,
          date_range_start, date_range_end, notes
        ) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        domain,
        stats.totalSnapshots || 0,
        stats.uniqueVersions || 0,
        stats.firstSnapshot || '',
        stats.lastSnapshot || '',
        ''
      );

      this.logger.debug(`Updated stats for domain: ${domain}`);
    } catch (error) {
      this.logger.error(`Failed to update domain stats: ${domain}`, error as Error);
      throw error;
    }
  }

  /**
   * Get domain summary statistics
   * @param domain - Domain name
   * @returns Domain statistics or null if not found
   */
  getDomainSummary(domain: string): DomainStats | null {
    try {
      const stmt = this.db.prepare(`
        SELECT
          COUNT(*) as total_snapshots,
          COUNT(DISTINCT digest) as unique_versions,
          COUNT(DISTINCT year) as years_covered,
          MIN(timestamp) as first_snapshot,
          MAX(timestamp) as last_snapshot,
          AVG(length) as avg_size,
          MAX(length) as max_size
        FROM snapshots
        WHERE domain = ?
      `);

      const row = stmt.get(domain) as Record<string, number | string> | undefined;

      if (!row || row.total_snapshots === 0) {
        return null;
      }

      return {
        domain,
        totalSnapshots: row.total_snapshots as number,
        uniqueVersions: row.unique_versions as number,
        yearsCovered: row.years_covered as number,
        firstSnapshot: row.first_snapshot as string,
        lastSnapshot: row.last_snapshot as string,
        avgSize: row.avg_size as number,
        maxSize: row.max_size as number,
      };
    } catch (error) {
      this.logger.error(`Failed to get domain summary: ${domain}`, error as Error);
      throw error;
    }
  }

  /**
   * Get yearly breakdown for a domain
   * @param domain - Domain name
   * @returns Array of yearly statistics
   */
  getYearlySummary(domain: string): YearlyStats[] {
    try {
      const stmt = this.db.prepare(`
        SELECT
          year,
          COUNT(*) as snapshots,
          COUNT(DISTINCT digest) as unique_versions,
          AVG(length) as avg_size,
          MAX(length) as max_size,
          GROUP_CONCAT(DISTINCT statuscode) as status_codes
        FROM snapshots
        WHERE domain = ?
        GROUP BY year
        ORDER BY year
      `);

      const rows = stmt.all(domain) as Record<string, number | string>[];

      return rows.map((row) => ({
        year: row.year as number,
        snapshots: row.snapshots as number,
        uniqueVersions: row.unique_versions as number,
        avgSize: row.avg_size as number,
        maxSize: row.max_size as number,
        statusCodes: row.status_codes as string,
      }));
    } catch (error) {
      this.logger.error(`Failed to get yearly summary: ${domain}`, error as Error);
      throw error;
    }
  }

  /**
   * Get significant snapshots for a domain
   * @param domain - Domain name
   * @param limit - Maximum number of results
   * @returns Array of significant snapshots
   */
  getSignificantSnapshots(domain: string, limit?: number): Snapshot[] {
    try {
      let query = `
        SELECT * FROM snapshots
        WHERE domain = ?
        ORDER BY is_significant_change DESC, change_score DESC, timestamp ASC
      `;

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(domain) as Array<Record<string, unknown>>;

      return rows.map((row) => this.rowToSnapshot(row));
    } catch (error) {
      this.logger.error(`Failed to get significant snapshots: ${domain}`, error as Error);
      throw error;
    }
  }

  /**
   * Convert database row to Snapshot object
   * @param row - Database row
   * @returns Snapshot object
   */
  private rowToSnapshot(row: Record<string, unknown>): Snapshot {
    return {
      id: row.id as number,
      domain: row.domain as string,
      url: row.url as string,
      timestamp: row.timestamp as string,
      year: row.year as number,
      statuscode: row.statuscode as string,
      mimetype: row.mimetype as string,
      digest: row.digest as string,
      length: row.length as number,
      isUniqueContent: Boolean(row.is_unique_content),
      isSignificantChange: Boolean(row.is_significant_change),
      changeScore: row.change_score as number,
    };
  }

  /**
   * Check if an asset has already been downloaded (by Wayback URL)
   * @param waybackUrl - The full Wayback Machine URL
   * @returns Asset record if exists, null otherwise
   */
  getAssetByWaybackUrl(waybackUrl: string): any | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM assets WHERE wayback_url = ?');
      return stmt.get(waybackUrl) || null;
    } catch (error) {
      this.logger.error(`Failed to get asset by Wayback URL: ${waybackUrl}`, error as Error);
      return null;
    }
  }

  /**
   * Get an asset by its content hash
   * @param contentHash - SHA-256 hash of the content
   * @returns Asset record if exists, null otherwise
   */
  getAssetByContentHash(contentHash: string): any | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM assets WHERE content_hash = ?');
      return stmt.get(contentHash) || null;
    } catch (error) {
      this.logger.error(`Failed to get asset by content hash: ${contentHash}`, error as Error);
      return null;
    }
  }

  /**
   * Save a new asset record
   * @param asset - Asset information to save
   */
  saveAsset(asset: {
    waybackUrl: string;
    originalUrl: string;
    contentHash: string;
    filePath: string;
    sizeBytes: number;
    mimeType?: string;
    domain?: string;
    timestamp?: string;
  }): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO assets (
          wayback_url, original_url, content_hash, file_path,
          size_bytes, mime_type, domain, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        asset.waybackUrl,
        asset.originalUrl,
        asset.contentHash,
        asset.filePath,
        asset.sizeBytes,
        asset.mimeType || null,
        asset.domain || null,
        asset.timestamp || null
      );

      this.logger.debug(`Asset saved: ${asset.originalUrl} (hash: ${asset.contentHash.substring(0, 8)}...)`);
    } catch (error) {
      this.logger.error(`Failed to save asset: ${asset.originalUrl}`, error as Error);
      throw error;
    }
  }

  /**
   * Increment the download count for an existing asset
   * @param waybackUrl - The Wayback URL that was reused
   */
  incrementAssetDownloadCount(waybackUrl: string): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE assets
        SET download_count = download_count + 1
        WHERE wayback_url = ?
      `);

      stmt.run(waybackUrl);
      this.logger.debug(`Incremented download count for: ${waybackUrl}`);
    } catch (error) {
      this.logger.error(`Failed to increment download count: ${waybackUrl}`, error as Error);
    }
  }

  /**
   * Get asset deduplication statistics
   * @returns Statistics about asset reuse
   */
  getAssetStats(): {
    totalAssets: number;
    totalDownloads: number;
    duplicatesAvoided: number;
    diskSpaceSavedBytes: number;
  } {
    try {
      const stats = this.db.prepare(`
        SELECT
          COUNT(*) as totalAssets,
          SUM(download_count) as totalDownloads,
          SUM(download_count - 1) as duplicatesAvoided,
          SUM(size_bytes * (download_count - 1)) as diskSpaceSavedBytes
        FROM assets
      `).get() as any;

      return {
        totalAssets: stats.totalAssets || 0,
        totalDownloads: stats.totalDownloads || 0,
        duplicatesAvoided: stats.duplicatesAvoided || 0,
        diskSpaceSavedBytes: stats.diskSpaceSavedBytes || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get asset stats', error as Error);
      return {
        totalAssets: 0,
        totalDownloads: 0,
        duplicatesAvoided: 0,
        diskSpaceSavedBytes: 0,
      };
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    try {
      this.db.close();
      this.logger.info('Database connection closed');
    } catch (error) {
      this.logger.error('Failed to close database', error as Error);
      throw error;
    }
  }

  /**
   * Begin a transaction
   * @returns Transaction object
   */
  beginTransaction(): Database.Transaction {
    return this.db.transaction((callback: () => void) => {
      callback();
    });
  }
}
