/**
 * Selective Wayback Crawler
 * Fetches the first snapshot plus N snapshots with "substantive changes"
 *
 * Substantive change is defined as:
 * - Content digest is different from the last captured snapshot
 * - AND one of:
 *   - Content length changed by ≥30%
 *   - At least 180 days elapsed AND content length changed by ≥15%
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { CDXRecord } from '../models/types';

export interface SubstantiveChangeConfig {
  /** Minimum size change percentage for immediate substantive (default: 30) */
  minSizeChangePercent: number;
  /** Minimum size change with time factor (default: 15) */
  minSizeChangeWithTime: number;
  /** Days elapsed to consider time-based change (default: 180) */
  daysForTimeBasedChange: number;
  /** Maximum substantive snapshots to capture after first (default: 3) */
  maxSubstantiveSnapshots: number;
}

export interface SelectiveCrawlerOptions {
  domain: string;
  outputDir: string;
  config?: Partial<SubstantiveChangeConfig>;
  fetchAssets?: boolean;
  noDelay?: boolean;
  verbose?: boolean;
  /** Filter by start date (YYYYMMDD or YYYY) */
  fromDate?: string;
  /** Filter by end date (YYYYMMDD or YYYY) */
  toDate?: string;
}

export interface SnapshotMetadata {
  timestamp: string;
  url: string;
  digest: string;
  length: number;
  statuscode: string;
  captureReason: 'first' | 'substantive';
  changeDetails?: {
    sizeChangePercent: number;
    daysElapsed: number;
    previousDigest: string;
  };
}

export interface CrawlResult {
  domain: string;
  totalSnapshotsAvailable: number;
  snapshotsCaptured: SnapshotMetadata[];
  skippedSnapshots: number;
  outputDir: string;
}

const DEFAULT_CONFIG: SubstantiveChangeConfig = {
  minSizeChangePercent: 30,
  minSizeChangeWithTime: 15,
  daysForTimeBasedChange: 180,
  maxSubstantiveSnapshots: 3,
};

export class SelectiveCrawler {
  private client: AxiosInstance;
  private config: SubstantiveChangeConfig;
  private domain: string;
  private outputDir: string;
  private fetchAssets: boolean;
  private noDelay: boolean;
  private verbose: boolean;
  private fromDate?: string;
  private toDate?: string;

  constructor(options: SelectiveCrawlerOptions) {
    this.domain = options.domain;
    this.outputDir = options.outputDir;
    this.fetchAssets = options.fetchAssets ?? false;
    this.noDelay = options.noDelay ?? false;
    this.verbose = options.verbose ?? false;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.fromDate = options.fromDate;
    this.toDate = options.toDate;

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'SelectiveWaybackCrawler/1.0 (personal archive research)',
      },
    });

    // Create output directory
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * Fetch CDX records for the domain
   */
  async fetchCDXRecords(): Promise<CDXRecord[]> {
    const dateRange = this.fromDate || this.toDate
      ? ` (${this.fromDate || 'start'} to ${this.toDate || 'now'})`
      : '';
    this.log(`Fetching CDX records for ${this.domain}${dateRange}...`);

    const url = 'https://web.archive.org/cdx/search/cdx';
    const params: Record<string, string> = {
      url: this.domain,
      matchType: 'domain',
      output: 'json',
      filter: 'statuscode:200',
      fl: 'urlkey,timestamp,original,mimetype,statuscode,digest,length',
    };

    // Add date range filters if specified
    if (this.fromDate) {
      params.from = this.fromDate;
    }
    if (this.toDate) {
      params.to = this.toDate;
    }

    try {
      const response = await this.client.get(url, { params });
      const data = response.data as string[][];

      if (!data || data.length < 2) {
        this.log('No snapshots found for domain');
        return [];
      }

      // Skip header row
      const records: CDXRecord[] = data.slice(1).map((row) => ({
        urlkey: row[0],
        timestamp: row[1],
        original: row[2],
        mimetype: row[3],
        statuscode: row[4],
        digest: row[5],
        length: parseInt(row[6], 10) || 0,
      }));

      // Filter to HTML pages - prefer homepages but include index pages if no homepage
      let htmlRecords = records.filter(
        (r) => r.mimetype === 'text/html' && r.original.match(/^https?:\/\/[^/]+\/?$/)
      );

      // If no homepage snapshots, try index pages or any main entry point
      if (htmlRecords.length === 0) {
        htmlRecords = records.filter(
          (r) => r.mimetype === 'text/html' &&
            (r.original.match(/\/(index\.html?)?$/) || r.original.match(/\/demo\/?$/))
        );
        if (htmlRecords.length > 0) {
          this.log(`No homepage found, using ${htmlRecords.length} index/demo pages instead`);
        }
      }

      // If still none, just get all HTML
      if (htmlRecords.length === 0) {
        htmlRecords = records.filter((r) => r.mimetype === 'text/html');
        if (htmlRecords.length > 0) {
          this.log(`Using all ${htmlRecords.length} HTML pages`);
        }
      }

      this.log(`Found ${records.length} total records, ${htmlRecords.length} HTML homepage snapshots`);
      return htmlRecords.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      console.error('Error fetching CDX records:', error);
      throw error;
    }
  }

  /**
   * Parse timestamp to Date
   */
  private parseTimestamp(timestamp: string): Date {
    const year = parseInt(timestamp.slice(0, 4), 10);
    const month = parseInt(timestamp.slice(4, 6), 10) - 1;
    const day = parseInt(timestamp.slice(6, 8), 10);
    const hour = parseInt(timestamp.slice(8, 10), 10) || 0;
    const minute = parseInt(timestamp.slice(10, 12), 10) || 0;
    const second = parseInt(timestamp.slice(12, 14), 10) || 0;
    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Calculate days between two timestamps
   */
  private daysBetween(timestamp1: string, timestamp2: string): number {
    const date1 = this.parseTimestamp(timestamp1);
    const date2 = this.parseTimestamp(timestamp2);
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if a snapshot represents a substantive change
   */
  private isSubstantiveChange(
    current: CDXRecord,
    lastCaptured: CDXRecord
  ): { isSubstantive: boolean; details: { sizeChangePercent: number; daysElapsed: number } } {
    // Must have different digest (content actually changed)
    if (current.digest === lastCaptured.digest) {
      return { isSubstantive: false, details: { sizeChangePercent: 0, daysElapsed: 0 } };
    }

    const daysElapsed = this.daysBetween(lastCaptured.timestamp, current.timestamp);
    const sizeChangePercent =
      lastCaptured.length > 0
        ? Math.abs((current.length - lastCaptured.length) / lastCaptured.length) * 100
        : 100;

    // Check substantive conditions
    const isSubstantive =
      // Large size change (≥30%)
      sizeChangePercent >= this.config.minSizeChangePercent ||
      // Time-based: 180+ days AND moderate size change (≥15%)
      (daysElapsed >= this.config.daysForTimeBasedChange &&
        sizeChangePercent >= this.config.minSizeChangeWithTime);

    return { isSubstantive, details: { sizeChangePercent, daysElapsed } };
  }

  /**
   * Select snapshots to capture based on substantive change criteria
   */
  selectSnapshots(records: CDXRecord[]): { selected: CDXRecord[]; metadata: Map<string, SnapshotMetadata> } {
    if (records.length === 0) {
      return { selected: [], metadata: new Map() };
    }

    const selected: CDXRecord[] = [];
    const metadata = new Map<string, SnapshotMetadata>();

    // Always capture the first snapshot
    const first = records[0];
    selected.push(first);
    metadata.set(first.timestamp, {
      timestamp: first.timestamp,
      url: first.original,
      digest: first.digest,
      length: first.length,
      statuscode: first.statuscode,
      captureReason: 'first',
    });

    this.log(`Selected first snapshot: ${first.timestamp} (${this.formatDate(first.timestamp)})`);

    let lastCaptured = first;
    let substantiveCount = 0;

    // Evaluate remaining snapshots
    for (let i = 1; i < records.length && substantiveCount < this.config.maxSubstantiveSnapshots; i++) {
      const current = records[i];
      const { isSubstantive, details } = this.isSubstantiveChange(current, lastCaptured);

      if (isSubstantive) {
        selected.push(current);
        metadata.set(current.timestamp, {
          timestamp: current.timestamp,
          url: current.original,
          digest: current.digest,
          length: current.length,
          statuscode: current.statuscode,
          captureReason: 'substantive',
          changeDetails: {
            sizeChangePercent: details.sizeChangePercent,
            daysElapsed: details.daysElapsed,
            previousDigest: lastCaptured.digest,
          },
        });

        this.log(
          `Selected substantive change #${substantiveCount + 1}: ${current.timestamp} ` +
            `(${this.formatDate(current.timestamp)}) - ` +
            `size: ${details.sizeChangePercent.toFixed(1)}% change, ${details.daysElapsed} days elapsed`
        );

        lastCaptured = current;
        substantiveCount++;
      }
    }

    this.log(`\nTotal selected: ${selected.length} snapshots (1 first + ${substantiveCount} substantive)`);
    return { selected, metadata };
  }

  /**
   * Format timestamp for display
   */
  private formatDate(timestamp: string): string {
    const date = this.parseTimestamp(timestamp);
    return date.toISOString().split('T')[0];
  }

  /**
   * Fetch and save a single snapshot
   */
  async fetchSnapshot(record: CDXRecord, meta: SnapshotMetadata): Promise<string> {
    const waybackUrl = `https://web.archive.org/web/${record.timestamp}id_/${record.original}`;

    if (!this.noDelay) {
      await this.delay(2000);
    }

    this.log(`Fetching: ${waybackUrl}`);

    try {
      const response = await this.client.get(waybackUrl);
      const content = response.data as string;

      // Create output directory
      const snapshotDir = path.join(this.outputDir, this.domain, record.timestamp);
      fs.mkdirSync(snapshotDir, { recursive: true });

      // Save HTML
      const htmlPath = path.join(snapshotDir, 'index.html');
      fs.writeFileSync(htmlPath, content, 'utf-8');

      // Save metadata
      const metaPath = path.join(snapshotDir, 'metadata.json');
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

      this.log(`  Saved to: ${snapshotDir}`);
      return htmlPath;
    } catch (error) {
      console.error(`  Error fetching ${waybackUrl}:`, error);
      throw error;
    }
  }

  /**
   * Save all CDX metadata to JSON for reference
   */
  private saveAllMetadata(records: CDXRecord[]): void {
    const metadataPath = path.join(this.outputDir, this.domain, 'all_snapshots_metadata.json');
    const domainDir = path.join(this.outputDir, this.domain);
    fs.mkdirSync(domainDir, { recursive: true });

    const metadata = {
      domain: this.domain,
      fetchedAt: new Date().toISOString(),
      totalSnapshots: records.length,
      snapshots: records.map(r => ({
        timestamp: r.timestamp,
        url: r.original,
        digest: r.digest,
        length: r.length,
        statuscode: r.statuscode,
      })),
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    this.log(`Stored metadata for ${records.length} total snapshots to ${metadataPath}`);
  }

  /**
   * Run the selective crawl
   */
  async run(): Promise<CrawlResult> {
    console.log('\n' + '='.repeat(70));
    console.log(`Selective Wayback Crawler - ${this.domain}`);
    console.log('='.repeat(70));
    console.log(`Config: First snapshot + up to ${this.config.maxSubstantiveSnapshots} substantive changes`);
    console.log(`Substantive = different content AND (≥${this.config.minSizeChangePercent}% size OR ≥${this.config.daysForTimeBasedChange} days + ≥${this.config.minSizeChangeWithTime}% size)`);
    console.log('='.repeat(70) + '\n');

    // Fetch CDX records
    const records = await this.fetchCDXRecords();

    if (records.length === 0) {
      return {
        domain: this.domain,
        totalSnapshotsAvailable: 0,
        snapshotsCaptured: [],
        skippedSnapshots: 0,
        outputDir: this.outputDir,
      };
    }

    // Save all metadata for reference (as JSON)
    this.saveAllMetadata(records);

    // Select snapshots to capture
    const { selected, metadata } = this.selectSnapshots(records);

    // Fetch selected snapshots
    console.log('\n--- Fetching selected snapshots ---\n');
    const captured: SnapshotMetadata[] = [];

    for (const record of selected) {
      const meta = metadata.get(record.timestamp)!;
      try {
        await this.fetchSnapshot(record, meta);
        captured.push(meta);
      } catch (error) {
        console.error(`Failed to fetch ${record.timestamp}, continuing...`);
      }
    }

    // Generate summary report
    const summaryPath = path.join(this.outputDir, this.domain, 'crawl_summary.json');
    const summary = {
      domain: this.domain,
      crawledAt: new Date().toISOString(),
      config: this.config,
      totalSnapshotsAvailable: records.length,
      snapshotsCaptured: captured,
      skippedSnapshots: records.length - captured.length,
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

    console.log('\n' + '='.repeat(70));
    console.log('CRAWL COMPLETE');
    console.log('='.repeat(70));
    console.log(`Domain: ${this.domain}`);
    console.log(`Total available: ${records.length}`);
    console.log(`Captured: ${captured.length}`);
    console.log(`Output: ${path.join(this.outputDir, this.domain)}`);
    console.log('='.repeat(70) + '\n');

    return {
      domain: this.domain,
      totalSnapshotsAvailable: records.length,
      snapshotsCaptured: captured,
      skippedSnapshots: records.length - captured.length,
      outputDir: path.join(this.outputDir, this.domain),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  close(): void {
    // No database to close - using JSON files
  }
}
