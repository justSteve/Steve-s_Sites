// src/services/AssetFetcher.ts
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { AssetReference, SkippedAsset } from '../models/AssetTypes';
import { LoggingService } from './LoggingService';

export interface AssetFetcherOptions {
  outputDir: string;
  maxAssetSizeMB: number;
  concurrency: number;
}

export interface FetchResult {
  fetched: AssetReference[];
  skipped: SkippedAsset[];
  errors: Array<{ asset: AssetReference; error: string }>;
}

/**
 * Fetches assets from Wayback Machine with size limits and error handling
 */
export class AssetFetcher {
  private options: AssetFetcherOptions;
  private logger?: LoggingService;

  constructor(options: AssetFetcherOptions, logger?: LoggingService) {
    this.options = options;
    this.logger = logger;
  }

  /**
   * Fetch multiple assets with concurrency control
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
   * Fetch a single asset from Wayback Machine
   */
  private async fetchSingleAsset(
    asset: AssetReference,
    domain: string,
    timestamp: string
  ): Promise<{ success: boolean; skipped?: SkippedAsset }> {
    const waybackUrl = `https://web.archive.org/web/${timestamp}/${asset.url}`;

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
