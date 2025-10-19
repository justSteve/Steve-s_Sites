/**
 * Wayback Machine Crawler for JustSteve.com Archive
 * Politely crawls archived sites, with optional off-peak hour scheduling
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { LoggingService, createLogger } from './LoggingService';
import Database from 'better-sqlite3';
import { AssetExtractor } from './AssetExtractor';
import { AssetFetcher, FetchResult } from './AssetFetcher';
import { URLRewriter } from './URLRewriter';
import { AssetManifest, SkippedAsset } from '../models/AssetTypes';

interface CrawlOptions {
  useOffPeakScheduler?: boolean;
  offPeakStart?: { hour: number; minute: number };
  offPeakEnd?: { hour: number; minute: number };
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  outputDir?: string;
  snapshotListFile?: string;
  logFile?: string;

  // Asset fetching options
  noDelay?: boolean;
  fetchAssets?: boolean;
  fetchExternalAssets?: boolean;
  maxAssetSizeMB?: number;
  assetConcurrency?: number;
}

interface UrlRecord {
  url: string;
  timestamp: string;
  domain: string;
}

interface CrawlStats {
  pending?: number;
  completed?: number;
  failed?: number;
}

/**
 * Manages crawler database operations
 */
export class CrawlerDB {
  private dbPath: string;
  private logger: LoggingService;
  private db: Database.Database;

  constructor(dbPath: string = 'crawler_state.db', logger: LoggingService) {
    this.dbPath = dbPath;
    this.logger = logger;
    this.db = new Database(dbPath);
    this.initDb();
  }

  private initDb(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS urls (
        url TEXT,
        timestamp TEXT,
        domain TEXT,
        status TEXT NOT NULL,
        local_path TEXT,
        discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fetched_at TIMESTAMP,
        error TEXT,
        PRIMARY KEY (url, timestamp)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS crawler_state (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }

  addUrl(url: string, timestamp: string, domain: string, status: string = 'pending'): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO urls (url, timestamp, domain, status) VALUES (?, ?, ?, ?)'
    );
    stmt.run(url, timestamp, domain, status);
  }

  getNextUrl(): UrlRecord | null {
    const stmt = this.db.prepare(
      'SELECT url, timestamp, domain FROM urls WHERE status = ? LIMIT 1'
    );
    const result = stmt.get('pending') as any;

    if (!result) return null;

    return {
      url: result.url,
      timestamp: result.timestamp,
      domain: result.domain
    };
  }

  markCompleted(url: string, timestamp: string, localPath: string): void {
    const stmt = this.db.prepare(
      `UPDATE urls
       SET status = 'completed', local_path = ?, fetched_at = CURRENT_TIMESTAMP
       WHERE url = ? AND timestamp = ?`
    );
    stmt.run(localPath, url, timestamp);
  }

  markFailed(url: string, timestamp: string, error: string): void {
    const stmt = this.db.prepare(
      `UPDATE urls
       SET status = 'failed', error = ?, fetched_at = CURRENT_TIMESTAMP
       WHERE url = ? AND timestamp = ?`
    );
    stmt.run(error, url, timestamp);
  }

  getStats(): CrawlStats {
    const stmt = this.db.prepare(
      'SELECT status, COUNT(*) as count FROM urls GROUP BY status'
    );
    const results = stmt.all() as any[];

    const stats: CrawlStats = {};
    results.forEach((row: any) => {
      stats[row.status as keyof CrawlStats] = row.count;
    });

    return stats;
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Polite crawler for Wayback Machine archives
 */
export class WaybackCrawler {
  private db: CrawlerDB;
  private session: AxiosInstance;
  private logger: LoggingService;
  private options: Required<CrawlOptions>;
  private assetExtractor?: AssetExtractor;
  private assetFetcher?: AssetFetcher;
  private urlRewriter?: URLRewriter;

  constructor(options: CrawlOptions = {}) {
    this.options = {
      useOffPeakScheduler: options.useOffPeakScheduler ?? true,
      offPeakStart: options.offPeakStart ?? { hour: 22, minute: 0 },
      offPeakEnd: options.offPeakEnd ?? { hour: 6, minute: 0 },
      minDelaySeconds: options.minDelaySeconds ?? 30,
      maxDelaySeconds: options.maxDelaySeconds ?? 120,
      outputDir: options.outputDir ?? 'archived_pages',
      snapshotListFile: options.snapshotListFile ?? '',
      logFile: options.logFile ?? 'crawler.log',

      // Asset defaults
      noDelay: options.noDelay ?? false,
      fetchAssets: options.fetchAssets ?? true,
      fetchExternalAssets: options.fetchExternalAssets ?? true,
      maxAssetSizeMB: options.maxAssetSizeMB ?? 50,
      assetConcurrency: options.assetConcurrency ?? 10,
    };

    this.logger = createLogger('WaybackCrawler', this.options.logFile);
    this.db = new CrawlerDB('crawler_state.db', this.logger);
    this.session = axios.create({
      headers: {
        'User-Agent': 'JustSteveCrawler/1.0 (Archival Research; slow/polite crawler)'
      },
      timeout: 30000
    });

    // Create output directory
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Initialize asset services if enabled
    if (this.options.fetchAssets) {
      // We'll need a domain - we'll set this properly when processing each URL
      // For now, create placeholder services that will be reinitialized per domain
      this.assetExtractor = new AssetExtractor('');
      this.assetFetcher = new AssetFetcher({
        outputDir: this.options.outputDir,
        maxAssetSizeMB: this.options.maxAssetSizeMB,
        concurrency: this.options.assetConcurrency,
      }, this.logger);
      this.urlRewriter = new URLRewriter('');
    }
  }

  /**
   * Load snapshot list from file and populate database
   */
  loadSnapshotList(): void {
    if (!this.options.snapshotListFile) {
      return;
    }

    const filePath = this.options.snapshotListFile;
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Snapshot list file not found: ${filePath}`);
      return;
    }

    this.logger.info(`Loading snapshot list from: ${filePath}`);
    let count = 0;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const parts = trimmed.split('|');
      if (parts.length === 2) {
        const [timestamp, url] = parts;
        // Extract domain from URL
        try {
          const parsed = new URL(url);
          const domain = parsed.hostname.replace('www.', '');
          this.db.addUrl(url, timestamp, domain);
          count++;
        } catch (err) {
          this.logger.warn(`Invalid URL in snapshot list: ${url}`);
        }
      }
    }

    this.logger.info(`Loaded ${count} snapshots from list`);
  }

  /**
   * Check if current time is in off-peak hours
   */
  private isOffPeak(): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = this.options.offPeakStart.hour * 60 + this.options.offPeakStart.minute;
    const endMinutes = this.options.offPeakEnd.hour * 60 + this.options.offPeakEnd.minute;

    if (startMinutes > endMinutes) {
      // Spans midnight
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    } else {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
  }

  /**
   * Wait until off-peak hours if scheduler is enabled
   */
  private async waitForOffPeak(): Promise<void> {
    if (!this.options.useOffPeakScheduler || this.options.noDelay) {
      return;
    }

    if (this.isOffPeak()) {
      return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = this.options.offPeakStart.hour * 60 + this.options.offPeakStart.minute;

    let waitMinutes: number;
    if (currentMinutes < startMinutes) {
      waitMinutes = startMinutes - currentMinutes;
    } else {
      // Wait until tomorrow's off-peak
      waitMinutes = (24 * 60) - currentMinutes + startMinutes;
    }

    const waitMs = waitMinutes * 60 * 1000;
    const resumeTime = new Date(Date.now() + waitMs);

    this.logger.info(
      `Off-peak scheduler enabled. Waiting until ${resumeTime.toLocaleString()}`
    );

    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  /**
   * Normalize URL to remove Wayback Machine artifacts
   */
  private normalizeUrl(url: string): string {
    if (url.includes('web.archive.org')) {
      const parts = url.split('/http');
      if (parts.length > 1) {
        return 'http' + parts[parts.length - 1];
      }
    }
    return url;
  }

  /**
   * Check if URL is internal to the specified domain
   */
  private isInternalUrl(url: string, domain: string): boolean {
    try {
      const normalized = this.normalizeUrl(url);
      const parsed = new URL(normalized);
      const domainVariants = [domain, `www.${domain}`, ''];
      return domainVariants.includes(parsed.hostname);
    } catch {
      return false;
    }
  }

  /**
   * Extract all internal links from HTML
   */
  private extractLinks(html: string, baseUrl: string, domain: string): Set<string> {
    const $ = cheerio.load(html);
    const links = new Set<string>();

    $('a, link, img, script').each((_, element) => {
      const href = $(element).attr('href') || $(element).attr('src');
      if (!href) return;

      try {
        // Make absolute
        const absoluteUrl = new URL(href, baseUrl).toString();
        const normalized = this.normalizeUrl(absoluteUrl);

        if (this.isInternalUrl(normalized, domain)) {
          links.add(normalized);
        }
      } catch {
        // Invalid URL, skip
      }
    });

    return links;
  }

  /**
   * Fetch a page from the Wayback Machine
   */
  private async fetchPage(url: string, timestamp: string): Promise<string | null> {
    const normalized = this.normalizeUrl(url);
    const waybackUrl = `https://web.archive.org/web/${timestamp}/${normalized}`;

    try {
      this.logger.info(`Fetching: ${waybackUrl}`);
      const response = await this.session.get(waybackUrl);
      return response.data;
    } catch (err: any) {
      this.logger.error(`Error fetching ${waybackUrl}: ${err.message}`);
      return null;
    }
  }

  /**
   * Save page content to disk organized by domain and timestamp
   */
  private savePage(url: string, timestamp: string, domain: string, content: string): string {
    const normalized = this.normalizeUrl(url);
    const parsed = new URL(normalized);

    // Create local path organized by domain/timestamp
    let pathPart = parsed.pathname.replace(/^\//, '');
    if (!pathPart) {
      pathPart = 'index.html';
    } else if (!pathPart.match(/\.(html|htm)$/)) {
      pathPart = path.join(pathPart, 'index.html');
    }

    const localPath = path.join(this.options.outputDir, domain, timestamp, pathPart);
    const dirPath = path.dirname(localPath);

    // Create directory structure
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(localPath, content, 'utf-8');
    this.logger.info(`Saved to: ${localPath}`);

    return localPath;
  }

  /**
   * Process page with asset fetching
   */
  private async processPageWithAssets(
    html: string,
    url: string,
    domain: string,
    timestamp: string
  ): Promise<string> {
    if (!this.options.fetchAssets || !this.assetExtractor || !this.assetFetcher || !this.urlRewriter) {
      // Just return HTML without processing assets
      return html;
    }

    // Reinitialize extractors/rewriters for the current domain
    this.assetExtractor = new AssetExtractor(domain);
    this.urlRewriter = new URLRewriter(domain);

    this.logger.info(`Extracting assets from ${url}`);

    // Extract assets from HTML
    const fileName = this.getFileNameFromUrl(url);
    const assets = this.assetExtractor.extractFromHtml(html, url, fileName);

    // Filter external assets if disabled
    const assetsToFetch = this.options.fetchExternalAssets
      ? assets
      : assets.filter(a => !a.isExternal);

    this.logger.info(
      `Found ${assets.length} assets (${assetsToFetch.length} to fetch)`
    );

    // Fetch all assets in parallel
    const fetchResult = await this.assetFetcher.fetchAssets(assetsToFetch, domain, timestamp);

    this.logger.info(
      `Assets: ${fetchResult.fetched.length} fetched, ${fetchResult.skipped.length} skipped, ${fetchResult.errors.length} errors`
    );

    // Save skipped assets log
    if (fetchResult.skipped.length > 0) {
      await this.saveSkippedAssets(fetchResult.skipped, domain, timestamp);
    }

    // Rewrite HTML URLs
    const rewrittenHtml = this.urlRewriter.rewriteHtml(html, url);

    // Process CSS files and rewrite their URLs
    for (const asset of fetchResult.fetched.filter(a => a.type === 'css')) {
      await this.rewriteCssFile(asset.url, domain, timestamp);
    }

    // Save manifest
    await this.saveManifest(domain, timestamp, fetchResult, [fileName]);

    return rewrittenHtml;
  }

  /**
   * Get filename from URL for tracking
   */
  private getFileNameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      let pathPart = parsed.pathname.replace(/^\//, '');
      if (!pathPart) {
        return 'index.html';
      } else if (!pathPart.match(/\.(html|htm)$/)) {
        return path.join(pathPart, 'index.html');
      }
      return pathPart;
    } catch {
      return 'index.html';
    }
  }

  /**
   * Rewrite CSS file URLs
   */
  private async rewriteCssFile(cssUrl: string, domain: string, timestamp: string): Promise<void> {
    if (!this.urlRewriter) return;

    try {
      const cssPath = this.getAssetLocalPath(cssUrl, domain, timestamp);
      if (!fs.existsSync(cssPath)) return;

      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      const rewrittenCss = this.urlRewriter.rewriteCss(cssContent, cssUrl);
      fs.writeFileSync(cssPath, rewrittenCss);
    } catch (error: any) {
      this.logger.error(`Failed to rewrite CSS ${cssUrl}: ${error.message}`, error);
    }
  }

  /**
   * Get local path for an asset
   */
  private getAssetLocalPath(assetUrl: string, domain: string, timestamp: string): string {
    try {
      const urlObj = new URL(assetUrl);
      const isExternal = !urlObj.hostname.endsWith(domain);

      if (isExternal) {
        const externalDomain = urlObj.hostname;
        const assetRelativePath = urlObj.pathname.startsWith('/')
          ? urlObj.pathname.substring(1)
          : urlObj.pathname;

        return path.join(
          this.options.outputDir,
          domain,
          timestamp,
          'assets',
          'external',
          externalDomain,
          assetRelativePath
        );
      } else {
        const assetRelativePath = urlObj.pathname.startsWith('/')
          ? urlObj.pathname.substring(1)
          : urlObj.pathname;

        return path.join(
          this.options.outputDir,
          domain,
          timestamp,
          'assets',
          assetRelativePath
        );
      }
    } catch {
      return '';
    }
  }

  /**
   * Save skipped assets log
   */
  private async saveSkippedAssets(
    skipped: SkippedAsset[],
    domain: string,
    timestamp: string
  ): Promise<void> {
    const outputPath = path.join(this.options.outputDir, domain, timestamp, 'skipped_assets.json');
    const outputDir = path.dirname(outputPath);

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const data = {
      domain,
      timestamp,
      skipped,
    };

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  }

  /**
   * Save asset manifest
   */
  private async saveManifest(
    domain: string,
    timestamp: string,
    fetchResult: FetchResult,
    pages: string[]
  ): Promise<void> {
    const manifestPath = path.join(this.options.outputDir, domain, timestamp, 'manifest.json');
    const outputDir = path.dirname(manifestPath);

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const byType: Record<string, number> = {};
    fetchResult.fetched.forEach((asset) => {
      byType[asset.type] = (byType[asset.type] || 0) + 1;
    });

    const externalDomains = Array.from(
      new Set(
        fetchResult.fetched
          .filter((a) => a.isExternal)
          .map((a) => {
            try {
              return new URL(a.url).hostname;
            } catch {
              return '';
            }
          })
          .filter(h => h !== '')
      )
    );

    const manifest: AssetManifest = {
      domain,
      timestamp,
      crawledAt: new Date().toISOString(),
      pages,
      assets: {
        total: fetchResult.fetched.length,
        byType,
        totalSizeMB: 0, // TODO: Calculate from file sizes
        externalDomains,
      },
      skippedCount: fetchResult.skipped.length,
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Crawl a single URL from the queue
   */
  private async crawlOne(): Promise<boolean> {
    const result = this.db.getNextUrl();
    if (!result) {
      this.logger.info('No more URLs to crawl');
      return false;
    }

    const { url, timestamp, domain } = result;

    // Wait for off-peak hours if scheduler is enabled
    await this.waitForOffPeak();

    // Fetch the page
    const content = await this.fetchPage(url, timestamp);

    if (content) {
      // Process page with assets if enabled
      const processedContent = await this.processPageWithAssets(content, url, domain, timestamp);

      // Save the page (with rewritten URLs if assets were processed)
      const localPath = this.savePage(url, timestamp, domain, processedContent);
      this.db.markCompleted(url, timestamp, localPath);

      // Extract and queue new links (same timestamp, same domain)
      const links = this.extractLinks(content, url, domain);
      links.forEach(link => {
        this.db.addUrl(link, timestamp, domain);
      });

      this.logger.info(`Discovered ${links.size} links`);
    } else {
      this.db.markFailed(url, timestamp, 'Failed to fetch');
    }

    return true;
  }

  /**
   * Process all files for a given URL/link and then delay
   */
  private async processLinkWithDelay(): Promise<boolean> {
    // Process one link (which may discover multiple files)
    const hasMore = await this.crawlOne();

    if (!hasMore) {
      return false;
    }

    // Apply delay if not disabled
    if (!this.options.noDelay) {
      // Delay after all files for this link are processed (max 5 seconds)
      const delay = Math.min(
        Math.floor(
          Math.random() * (this.options.maxDelaySeconds - this.options.minDelaySeconds + 1) +
            this.options.minDelaySeconds
        ),
        5
      );
      this.logger.info(`Waiting ${delay} seconds before next link`);
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }

    return true;
  }

  /**
   * Main crawl loop
   */
  async run(): Promise<void> {
    this.logger.info('Starting crawler...');
    if (this.options.useOffPeakScheduler) {
      this.logger.info(
        `Off-peak scheduler enabled: ${this.options.offPeakStart.hour}:${this.options.offPeakStart.minute} - ${this.options.offPeakEnd.hour}:${this.options.offPeakEnd.minute}`
      );
    } else {
      this.logger.info('Off-peak scheduler disabled - running continuously');
    }
    this.logger.info('Delay strategy: After processing each link (max 5 seconds)');

    // Load snapshot list if provided
    this.loadSnapshotList();

    try {
      while (await this.processLinkWithDelay()) {
        // Print stats periodically
        const stats = this.db.getStats();
        this.logger.info(`Stats: ${JSON.stringify(stats)}`);
      }
    } catch (err: any) {
      if (err.message !== 'interrupted') {
        throw err;
      }
      this.logger.info('Crawler stopped by user');
    } finally {
      const stats = this.db.getStats();
      this.logger.info(`Final stats: ${JSON.stringify(stats)}`);
      this.db.close();
    }
  }
}
