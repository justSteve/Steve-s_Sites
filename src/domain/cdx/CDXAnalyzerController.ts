/**
 * Controller for CDX analysis operations
 * Orchestrates the analysis of Wayback Machine snapshots across multiple domains
 */

import { DomainConfig, Snapshot, CDXRecord } from '../models/types';
import { DatabaseService } from '../../services/DatabaseService';
import { WaybackAPIService } from '../crawler/WaybackAPIService';
import { LoggingService } from '../../services/LoggingService';
import { loadDomainsConfig } from '../../utils/ConfigLoader';
import { extractYear } from '../../utils/DateFormatter';

/**
 * Configuration for CDX Analyzer
 */
export interface CDXAnalyzerConfig {
  domainsConfigPath: string;
  dbPath: string;
  logPath: string;
  requestDelay?: number;
}

/**
 * CDXAnalyzerController handles the analysis of CDX data
 * for multiple domains following MVC pattern
 */
export class CDXAnalyzerController {
  private db: DatabaseService;
  private waybackAPI: WaybackAPIService;
  private logger: LoggingService;
  private domainsConfigPath: string;

  /**
   * Creates a new CDXAnalyzerController instance
   * @param config - Controller configuration
   */
  constructor(config: CDXAnalyzerConfig) {
    this.domainsConfigPath = config.domainsConfigPath;

    // Initialize logging service
    this.logger = new LoggingService('CDXAnalyzer', config.logPath);

    // Initialize database service
    this.db = new DatabaseService(config.dbPath, this.logger);
    this.db.initCDXSchema();

    // Initialize Wayback API service
    this.waybackAPI = new WaybackAPIService(
      this.logger.child('WaybackAPI'),
      config.requestDelay || 2000
    );

    this.logger.info('CDX Analyzer Controller initialized');
  }

  /**
   * Run analysis for all configured domains
   */
  async analyzeAllDomains(): Promise<void> {
    try {
      const config = loadDomainsConfig(this.domainsConfigPath);
      const domains = config.domains;

      if (domains.length === 0) {
        this.logger.warn('No domains configured for analysis');
        return;
      }

      this.logger.info(`Starting analysis for ${domains.length} domain(s)`);

      for (const domainConfig of domains) {
        try {
          await this.analyzeDomain(domainConfig);
        } catch (error) {
          this.logger.error(
            `Failed to analyze domain: ${domainConfig.name}`,
            error as Error
          );
          // Continue with next domain
        }
      }

      this.logger.info('Analysis complete for all domains');
    } catch (error) {
      this.logger.error('Failed to analyze domains', error as Error);
      throw error;
    }
  }

  /**
   * Analyze a single domain
   * @param domainConfig - Domain configuration
   */
  async analyzeDomain(domainConfig: DomainConfig): Promise<void> {
    const { name: domain } = domainConfig;

    this.logger.info('='.repeat(60));
    this.logger.info(`Analyzing domain: ${domain}`);
    this.logger.info('='.repeat(60));

    try {
      // Fetch CDX records with digest collapse (unique content only)
      const records = await this.waybackAPI.fetchCDXRecords({
        url: domain,
        collapse: 'digest',
      });

      if (records.length === 0) {
        this.logger.warn(`No snapshots found for ${domain}`);
        return;
      }

      // Analyze changes between snapshots
      let prevRecord: CDXRecord | null = null;

      for (const record of records) {
        const isUnique = true; // All records are unique due to digest collapse
        let isSignificant = false;
        let changeScore = 0.0;

        if (prevRecord) {
          changeScore = this.calculateChangeScore(prevRecord, record);
          isSignificant = changeScore > 50; // Threshold for significance
        }

        // Save snapshot to database
        const snapshot: Snapshot = {
          domain,
          url: record.original,
          timestamp: record.timestamp,
          year: extractYear(record.timestamp),
          statuscode: record.statuscode,
          mimetype: record.mimetype,
          digest: record.digest,
          length: record.length,
          isUniqueContent: isUnique,
          isSignificantChange: isSignificant,
          changeScore,
        };

        this.db.saveSnapshot(snapshot);
        prevRecord = record;
      }

      // Update domain statistics
      this.db.updateDomainStats(domain, {
        domain,
        totalSnapshots: records.length,
        uniqueVersions: records.length,
        firstSnapshot: records[0].timestamp,
        lastSnapshot: records[records.length - 1].timestamp,
        yearsCovered: 0, // Will be calculated from snapshots
        avgSize: 0,
        maxSize: 0,
      });

      this.logger.info(`Analysis complete for ${domain}: ${records.length} unique snapshots`);
    } catch (error) {
      this.logger.error(`Failed to analyze domain: ${domain}`, error as Error);
      throw error;
    }
  }

  /**
   * Calculate significance score for a change between two snapshots
   * Higher score indicates more significant change
   * @param prev - Previous CDX record
   * @param curr - Current CDX record
   * @returns Change score (0-∞, typically 0-200)
   */
  private calculateChangeScore(prev: CDXRecord, curr: CDXRecord): number {
    let score = 0.0;

    // Size change (normalized as percentage)
    if (prev.length > 0) {
      const sizeChangePercent = Math.abs(curr.length - prev.length) / prev.length;
      score += sizeChangePercent * 100;
    }

    // Status code change (major indicator)
    if (prev.statuscode !== curr.statuscode) {
      score += 50;
    }

    // MIME type change (significant indicator)
    if (prev.mimetype !== curr.mimetype) {
      score += 30;
    }

    // Digest is always different (filtered by collapse)
    score += 10;

    return Math.round(score * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Generate report for a specific domain
   * @param domain - Domain name
   */
  async generateReport(domain: string): Promise<void> {
    this.logger.info('='.repeat(60));
    this.logger.info(`ANALYSIS REPORT: ${domain}`);
    this.logger.info('='.repeat(60));

    try {
      // Overall summary
      const summary = this.db.getDomainSummary(domain);
      if (summary) {
        this.logger.info('\nOVERALL SUMMARY:');
        this.logger.info(`  Total snapshots: ${summary.totalSnapshots}`);
        this.logger.info(`  Unique content versions: ${summary.uniqueVersions}`);
        this.logger.info(`  Years covered: ${summary.yearsCovered}`);
        this.logger.info(
          `  Date range: ${summary.firstSnapshot} to ${summary.lastSnapshot}`
        );
        this.logger.info(`  Average size: ${Math.round(summary.avgSize)} bytes`);
        this.logger.info(`  Largest snapshot: ${summary.maxSize} bytes`);
      }

      // Year-by-year breakdown
      this.logger.info('\nYEAR-BY-YEAR BREAKDOWN:');
      const yearly = this.db.getYearlySummary(domain);
      for (const yearData of yearly) {
        this.logger.info(
          `  ${yearData.year}: ${yearData.snapshots} snapshots, ` +
            `${yearData.uniqueVersions} unique versions, ` +
            `avg size ${Math.round(yearData.avgSize)}b, ` +
            `status codes: ${yearData.statusCodes}`
        );
      }

      // Most significant changes
      this.logger.info('\nMOST SIGNIFICANT SNAPSHOTS (Top 10):');
      const significant = this.db.getSignificantSnapshots(domain, 10);
      for (const snap of significant) {
        this.logger.info(
          `  ${snap.timestamp.substring(0, 8)}: ` +
            `[${snap.statuscode}] ${snap.length}b ` +
            `(score: ${snap.changeScore.toFixed(1)})`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to generate report for ${domain}`, error as Error);
      throw error;
    }
  }

  /**
   * Generate reports for all analyzed domains
   */
  async generateAllReports(): Promise<void> {
    try {
      const config = loadDomainsConfig(this.domainsConfigPath);
      const domains = config.domains;

      this.logger.info('\n' + '='.repeat(60));
      this.logger.info('GENERATING REPORTS');
      this.logger.info('='.repeat(60));

      for (const domainConfig of domains) {
        await this.generateReport(domainConfig.name);
      }
    } catch (error) {
      this.logger.error('Failed to generate reports', error as Error);
      throw error;
    }
  }

  /**
   * Close all resources
   */
  async close(): Promise<void> {
    try {
      this.db.close();
      await this.logger.close();
    } catch (error) {
      this.logger.error('Failed to close resources', error as Error);
      throw error;
    }
  }
}
