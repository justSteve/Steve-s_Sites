import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { URL } from 'url';
import { AssetReference, SkippedAsset } from '../models/AssetTypes';
import { LoggingService } from '../../services/LoggingService';
import { DatabaseService } from '../../services/DatabaseService';

export interface AssetFetcherOptions {
  outputDir: string;
  maxAssetSizeMB: number;
  concurrency: number;
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
 * Fetches assets from Wayback Machine with deduplication and size limits
 */
export class AssetFetcher {
  private options: AssetFetcherOptions;
  private logger?: LoggingService;
  private db?: DatabaseService;

  constructor(options: AssetFetcherOptions, logger?: LoggingService, db?: DatabaseService) {
    this.options = options;
    this.logger = logger;
    this.db = db;
  }

  /**
   * Fetch multiple assets with concurrency control and deduplication
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

    // Process in batches based on concurrency limit
    const batches = this.chunkArray(assets, this.options.concurrency);

    for (const batch of batches) {
      const promises = batch.map(asset => this.fetchSingleAsset(asset, domain, timestamp));
      const batchResults = await Promise.allSettled(promises);

      batchResults.forEach((res, idx) => {
        const asset = batch[idx];
        if (res.status === 'fulfilled') {
          if (res.value.success) {
            result.fetched.push(asset);
          } else if (res.value.skipped) {
            result.skipped.push(res.value.skipped);
          } else if (res.value.cacheHit) {
            result.deduplication.cacheHits++;
            result.deduplication.bandwidthSavedMB += res.value.sizeMB || 0;
          } else if (res.value.contentDuplicate) {
            result.deduplication.contentDuplicates++;
          }
        } else {
          result.errors.push({ asset, error: res.reason.message });
          this.logger?.error(`Failed to fetch ${asset.url}: ${res.reason.message}`);
        }
      });
    }

    return result;
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
    const waybackUrl = `https://web.archive.org/web/${timestamp}/${asset.url}`;

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

    // STEP 2: Download the asset
    try {
      // Stream response to check size before downloading fully
      const response = await axios.get(waybackUrl, {
        responseType: 'stream',
        timeout: 30000,
        maxRedirects: 5,
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
