import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { URL } from 'url';
import { AssetReference, SkippedAsset } from '../models/AssetTypes';
import { LoggingService } from '../../services/LoggingService';
import { DatabaseService } from '../../services/DatabaseService';

export interface AuthConfig {
  loggedInUser: string;
  loggedInSig: string;
  s3Access?: string;
  s3Secret?: string;
}

export interface AssetFetcherOptions {
  outputDir: string;
  maxAssetSizeMB: number;
  concurrency: number;
  assetDelayMs?: number;  // Delay between asset fetches (default: 100ms)
  auth?: AuthConfig;      // Authentication config (required)
}

export interface FetchResult {
  fetched: AssetReference[];
  skipped: SkippedAsset[];
  errors: Array<{ asset: AssetReference; error: string }>;
  deduplication: {
    cacheHits: number;
    contentDuplicates: number;
    bandwidthSavedMB: number;
  };
}

/**
 * Fetches assets from Wayback Machine with deduplication, size limits, and rate limiting
 */
export class AssetFetcher {
  private options: AssetFetcherOptions;
  private logger?: LoggingService;
  private db?: DatabaseService;
  private session: AxiosInstance;
  private assetDelayMs: number;
  private fetchCount: number = 0;
  private errorCount: number = 0;

  constructor(options: AssetFetcherOptions, logger?: LoggingService, db?: DatabaseService) {
    this.options = options;
    this.logger = logger;
    this.db = db;
    this.assetDelayMs = options.assetDelayMs ?? 100;

    // Create authenticated session
    const headers: Record<string, string> = {
      'User-Agent': 'JustSteveCrawler/1.0 (personal archive; authenticated)',
    };

    if (options.auth) {
      headers['Cookie'] = `logged-in-user=${options.auth.loggedInUser}; logged-in-sig=${options.auth.loggedInSig}`;
      if (options.auth.s3Access && options.auth.s3Secret) {
        headers['Authorization'] = `LOW ${options.auth.s3Access}:${options.auth.s3Secret}`;
      }
    }

    this.session = axios.create({
      headers,
      timeout: 30000,
      maxRedirects: 5,
    });
  }

  /**
   * Delay helper
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch multiple assets sequentially with delays between each
   */
  public async fetchAssets(
    assets: AssetReference[],
    domain: string,
    timestamp: string
  ): Promise<FetchResult> {
    const result: FetchResult = {
      fetched: [],
      skipped: [],
      errors: [],
      deduplication: {
        cacheHits: 0,
        contentDuplicates: 0,
        bandwidthSavedMB: 0,
      },
    };

    this.fetchCount = 0;
    this.errorCount = 0;
    const startTime = Date.now();

    this.logger?.info(`Fetching ${assets.length} assets (${this.assetDelayMs}ms delay between each)`);

    // Process assets sequentially with delays
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];

      // Add delay before each fetch (except the first)
      if (i > 0) {
        await this.delay(this.assetDelayMs);
      }

      try {
        const fetchResult = await this.fetchSingleAsset(asset, domain, timestamp);
        this.fetchCount++;

        if (fetchResult.success) {
          result.fetched.push(asset);
        } else if (fetchResult.skipped) {
          result.skipped.push(fetchResult.skipped);
        } else if (fetchResult.cacheHit) {
          result.deduplication.cacheHits++;
          result.deduplication.bandwidthSavedMB += fetchResult.sizeMB || 0;
        } else if (fetchResult.contentDuplicate) {
          result.deduplication.contentDuplicates++;
          result.fetched.push(asset);  // Still counts as fetched
        }

        // Progress log every 10 assets
        if ((i + 1) % 10 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          this.logger?.info(`  Asset progress: ${i + 1}/${assets.length} (${elapsed}s elapsed)`);
        }

      } catch (err: any) {
        this.errorCount++;
        const errorMsg = this.formatError(err);
        result.errors.push({ asset, error: errorMsg });
        this.logger?.error(`Asset fetch failed [${asset.type}]: ${asset.url} - ${errorMsg}`);

        // If we hit rate limiting, add extra delay
        if (err.response?.status === 429) {
          const retryAfter = parseInt(err.response.headers['retry-after'] || '60', 10);
          this.logger?.warn(`Rate limited! Waiting ${retryAfter}s before continuing...`);
          await this.delay(retryAfter * 1000);
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger?.info(
      `Asset fetch complete: ${result.fetched.length} fetched, ${result.skipped.length} skipped, ` +
      `${result.errors.length} errors, ${result.deduplication.cacheHits} cache hits (${elapsed}s)`
    );

    return result;
  }

  /**
   * Format error message with status code if available
   */
  private formatError(err: any): string {
    if (err.response) {
      const status = err.response.status;
      const statusText = err.response.statusText || '';
      switch (status) {
        case 401: return `401 Unauthorized - auth cookies may be expired`;
        case 403: return `403 Forbidden - access denied`;
        case 404: return `404 Not Found in Wayback Machine`;
        case 429: return `429 Rate Limited`;
        case 500: return `500 Server Error`;
        case 503: return `503 Service Unavailable`;
        default: return `${status} ${statusText}`;
      }
    }
    if (err.code === 'ECONNREFUSED') return 'Connection refused';
    if (err.code === 'ETIMEDOUT') return 'Connection timeout';
    if (err.code === 'ENOTFOUND') return 'DNS lookup failed';
    return err.message || 'Unknown error';
  }

  /**
   * Fetch a single asset from Wayback Machine with deduplication
   */
  private async fetchSingleAsset(
    asset: AssetReference,
    domain: string,
    timestamp: string
  ): Promise<{
    success: boolean;
    skipped?: SkippedAsset;
    cacheHit?: boolean;
    contentDuplicate?: boolean;
    sizeMB?: number;
  }> {
    // Don't double-wrap URLs that are already Wayback URLs
    const waybackUrl = asset.url.startsWith('https://web.archive.org/') || asset.url.startsWith('https://web-static.archive.org/')
      ? asset.url
      : `https://web.archive.org/web/${timestamp}/${asset.url}`;

    // STEP 1: Check if this exact Wayback URL has been downloaded before
    if (this.db) {
      const cachedAsset = this.db.getAssetByWaybackUrl(waybackUrl);
      if (cachedAsset) {
        // Cache hit! Asset already downloaded, reuse it
        const assetPath = this.getAssetPath(asset, domain, timestamp);
        this.ensureDirectoryExists(path.dirname(assetPath));

        // Create hardlink to existing file (saves disk space)
        try {
          if (!fs.existsSync(assetPath)) {
            fs.linkSync(cachedAsset.file_path, assetPath);
          }
          this.db.incrementAssetDownloadCount(waybackUrl);
          const sizeMB = cachedAsset.size_bytes / (1024 * 1024);
          this.logger?.info(
            `Cache hit: ${asset.url} (saved ${sizeMB.toFixed(2)}MB download)`
          );
          return { success: false, cacheHit: true, sizeMB };
        } catch (linkError) {
          // If hardlink fails, fall through to download
          this.logger?.warn(`Failed to create hardlink, will download: ${linkError}`);
        }
      }
    }

    // STEP 2: Download the asset (using authenticated session)
    try {
      // Stream response to check size before downloading fully
      const response = await this.session.get(waybackUrl, {
        responseType: 'stream',
      });

      const contentLength = parseInt(response.headers['content-length'] || '0', 10);
      const sizeMB = contentLength / (1024 * 1024);

      // Check size limit
      if (sizeMB > this.options.maxAssetSizeMB) {
        const skipped: SkippedAsset = {
          url: asset.url,
          reason: 'size_limit',
          sizeMB,
          waybackUrl,
        };

        this.logger?.warn(
          `Skipping ${asset.url} (${sizeMB.toFixed(2)}MB exceeds ${this.options.maxAssetSizeMB}MB limit)`
        );

        return { success: false, skipped };
      }

      // Save asset to disk
      const assetPath = this.getAssetPath(asset, domain, timestamp);
      this.ensureDirectoryExists(path.dirname(assetPath));

      const writer = fs.createWriteStream(assetPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      // STEP 3: Compute content hash for deduplication
      if (this.db) {
        const contentHash = await this.computeFileHash(assetPath);
        const mimeType = response.headers['content-type'];

        // Check if this exact content already exists
        const existingAsset = this.db.getAssetByContentHash(contentHash);
        if (existingAsset && existingAsset.file_path !== assetPath) {
          // Content duplicate! Replace file with hardlink
          try {
            fs.unlinkSync(assetPath); // Delete the duplicate
            fs.linkSync(existingAsset.file_path, assetPath); // Link to original
            this.logger?.info(
              `Content duplicate: ${asset.url} links to existing ${existingAsset.original_url}`
            );
          } catch (linkError) {
            this.logger?.warn(`Failed to deduplicate content: ${linkError}`);
          }
        }

        // Save asset record to database
        this.db.saveAsset({
          waybackUrl,
          originalUrl: asset.url,
          contentHash,
          filePath: existingAsset?.file_path || assetPath, // Use original if deduplicated
          sizeBytes: contentLength,
          mimeType,
          domain,
          timestamp,
        });

        if (existingAsset && existingAsset.file_path !== assetPath) {
          return { success: true, contentDuplicate: true };
        }
      }

      this.logger?.info(`Fetched ${asset.type}: ${asset.url} (${sizeMB.toFixed(2)}MB)`);
      return { success: true };

    } catch (error: any) {
      if (error.response?.status === 404) {
        const skipped: SkippedAsset = {
          url: asset.url,
          reason: 'fetch_error',
          waybackUrl,
          error: '404 Not Found in Wayback Machine',
        };
        return { success: false, skipped };
      }
      throw error;
    }
  }

  /**
   * Compute SHA-256 hash of a file
   */
  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get the local file path for an asset
   */
  private getAssetPath(asset: AssetReference, domain: string, timestamp: string): string {
    const urlObj = new URL(asset.url);

    if (asset.isExternal) {
      // External: assets/external/{domain}/{path}
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
      // Same domain: assets/{path}
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
  }

  /**
   * Ensure directory exists, create if not
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Check if asset should be fetched (placeholder for future rules)
   */
  private shouldFetchAsset(asset: AssetReference): boolean {
    // Future: Add more sophisticated filtering
    return true;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
