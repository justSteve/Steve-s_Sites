/**
 * Wayback Machine Crawler for JustSteve.com Archive
 * Politely crawls archived sites, with optional off-peak hour scheduling
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { LoggingService, createLogger } from '../../services/LoggingService';
import Database from 'better-sqlite3';
import { AssetExtractor } from '../assets/AssetExtractor';
import { AssetFetcher, FetchResult } from '../assets/AssetFetcher';
import { URLRewriter } from '../assets/URLRewriter';
import { AssetManifest, SkippedAsset } from '../models/AssetTypes';

interface AuthConfig {
  loggedInUser: string;
  loggedInSig: string;
  s3Access?: string;
  s3Secret?: string;
}

interface CrawlOptions {
  // Authentication (REQUIRED)
  auth?: AuthConfig;

  // Scheduling
  useOffPeakScheduler?: boolean;
  offPeakStart?: { hour: number; minute: number };
  offPeakEnd?: { hour: number; minute: number };

  // Delays
  pageDelaySeconds?: number;      // Delay before starting next page (default: 5)
  assetDelayMs?: number;          // Delay between individual assets (default: 100)

  // Output
  outputDir?: string;
  snapshotListFile?: string;
  logFile?: string;

  // Asset fetching options
  fetchAssets?: boolean;
  fetchExternalAssets?: boolean;
  maxAssetSizeMB?: number;

  // Legacy (deprecated)
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  noDelay?: boolean;
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
 * Load auth config from .env file
 */
function loadAuthFromEnv(): AuthConfig | null {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }

  const loggedInUser = env['IA_LOGGED_IN_USER'];
  const loggedInSig = env['IA_LOGGED_IN_SIG'];

  if (!loggedInUser || !loggedInSig) {
    return null;
  }

  return {
    loggedInUser,
    loggedInSig,
    s3Access: env['IA_S3_ACCESS'],
    s3Secret: env['IA_S3_SECRET'],
  };
}

/**
 * Polite crawler for Wayback Machine archives
 * Requires authentication via .env file
 */
export class WaybackCrawler {
  private db: CrawlerDB;
  private session: AxiosInstance;
  private logger: LoggingService;
  private auth: AuthConfig;
  private options: {
    useOffPeakScheduler: boolean;
    offPeakStart: { hour: number; minute: number };
    offPeakEnd: { hour: number; minute: number };
    pageDelaySeconds: number;
    assetDelayMs: number;
    outputDir: string;
    snapshotListFile: string;
    logFile: string;
    fetchAssets: boolean;
    fetchExternalAssets: boolean;
    maxAssetSizeMB: number;
  };
  private assetExtractor?: AssetExtractor;
  private assetFetcher?: AssetFetcher;
  private urlRewriter?: URLRewriter;

  constructor(options: CrawlOptions = {}) {
    // Load and validate auth - REQUIRED
    const auth = options.auth ?? loadAuthFromEnv();
    if (!auth) {
      throw new Error(
        'Authentication required. Run: python python/test_wayback_auth.py --setup\n' +
        'Then ensure .env contains IA_LOGGED_IN_USER and IA_LOGGED_IN_SIG'
      );
    }
    this.auth = auth;

    this.options = {
      useOffPeakScheduler: options.useOffPeakScheduler ?? false,  // Default OFF for authenticated users
      offPeakStart: options.offPeakStart ?? { hour: 22, minute: 0 },
      offPeakEnd: options.offPeakEnd ?? { hour: 6, minute: 0 },
      pageDelaySeconds: options.pageDelaySeconds ?? 5,            // 5 seconds between pages
      assetDelayMs: options.assetDelayMs ?? 100,                  // 100ms between assets
      outputDir: options.outputDir ?? 'archived_pages',
      snapshotListFile: options.snapshotListFile ?? '',
      logFile: options.logFile ?? 'crawler.log',
      fetchAssets: options.fetchAssets ?? true,
      fetchExternalAssets: options.fetchExternalAssets ?? true,
      maxAssetSizeMB: options.maxAssetSizeMB ?? 50,
    };

    this.logger = createLogger('WaybackCrawler', this.options.logFile);
    this.db = new CrawlerDB('crawler_state.db', this.logger);

    // Create authenticated session
    this.session = axios.create({
      headers: {
        'User-Agent': 'JustSteveCrawler/1.0 (personal archive; authenticated)',
        'Cookie': `logged-in-user=${this.auth.loggedInUser}; logged-in-sig=${this.auth.loggedInSig}`,
        ...(this.auth.s3Access && this.auth.s3Secret
          ? { 'Authorization': `LOW ${this.auth.s3Access}:${this.auth.s3Secret}` }
          : {}),
      },
      timeout: 30000,
    });

    this.logger.info('Crawler initialized with authentication');
    this.logger.info(`Auth: logged-in-user=${this.auth.loggedInUser.substring(0, 10)}...`);

    // Create output directory
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Initialize asset services if enabled
    if (this.options.fetchAssets) {
      this.assetExtractor = new AssetExtractor('');
      this.assetFetcher = new AssetFetcher({
        outputDir: this.options.outputDir,
        maxAssetSizeMB: this.options.maxAssetSizeMB,
        concurrency: 1,  // Sequential with delays
        assetDelayMs: this.options.assetDelayMs,
        auth: this.auth,
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
    if (!this.options.useOffPeakScheduler) {
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
   * Process a page and all its assets, then delay before next page
   */
  private async processPageWithDelay(): Promise<boolean> {
    // Process one page (which fetches all assets with per-asset delays)
    const hasMore = await this.crawlOne();

    if (!hasMore) {
      return false;
    }

    // Fixed delay between pages (default 5 seconds)
    const delay = this.options.pageDelaySeconds;
    this.logger.info(`Waiting ${delay}s before next page...`);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));

    return true;
  }

  /**
   * Main crawl loop
   */
  async run(): Promise<void> {
    this.logger.info('='.repeat(60));
    this.logger.info('Starting authenticated crawler');
    this.logger.info('='.repeat(60));
    this.logger.info(`Delay strategy: ${this.options.assetDelayMs}ms per asset, ${this.options.pageDelaySeconds}s between pages`);

    if (this.options.useOffPeakScheduler) {
      this.logger.info(
        `Off-peak scheduler: ${this.options.offPeakStart.hour}:${String(this.options.offPeakStart.minute).padStart(2, '0')} - ${this.options.offPeakEnd.hour}:${String(this.options.offPeakEnd.minute).padStart(2, '0')}`
      );
    }

    // Load snapshot list if provided
    this.loadSnapshotList();

    let pagesProcessed = 0;
    const startTime = Date.now();

    try {
      while (await this.processPageWithDelay()) {
        pagesProcessed++;
        const stats = this.db.getStats();
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        this.logger.info(`Progress: ${pagesProcessed} pages in ${elapsed}min | pending=${stats.pending ?? 0}, completed=${stats.completed ?? 0}, failed=${stats.failed ?? 0}`);
      }
    } catch (err: any) {
      if (err.message !== 'interrupted') {
        this.logger.error(`Crawler error: ${err.message}`, err);
        throw err;
      }
      this.logger.info('Crawler stopped by user');
    } finally {
      const stats = this.db.getStats();
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      this.logger.info('='.repeat(60));
      this.logger.info(`Crawl complete: ${pagesProcessed} pages in ${elapsed} minutes`);
      this.logger.info(`Final: pending=${stats.pending ?? 0}, completed=${stats.completed ?? 0}, failed=${stats.failed ?? 0}`);
      this.logger.info('='.repeat(60));
      this.db.close();
    }
  }
}
