/**
 * Service for interacting with the Wayback Machine CDX API
 * Handles rate limiting, error handling, and data parsing
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { CDXRecord } from '../models/types';
import { LoggingService } from './LoggingService';

/**
 * Options for CDX API queries
 */
export interface CDXQueryOptions {
  /** URL or domain to query */
  url: string;
  /** Collapse parameter for deduplication */
  collapse?: 'digest' | 'timestamp:6' | 'timestamp:8' | 'timestamp:10' | 'urlkey';
  /** Output format */
  output?: 'text' | 'json';
  /** Filter by status code */
  filter?: string;
  /** From timestamp (YYYYMMDDHHMMSS) */
  from?: string;
  /** To timestamp (YYYYMMDDHHMMSS) */
  to?: string;
}

/**
 * WaybackAPIService handles all interactions with the
 * Wayback Machine CDX Server API
 */
export class WaybackAPIService {
  private client: AxiosInstance;
  private logger: LoggingService;
  private readonly baseURL = 'https://web.archive.org/cdx/search/cdx';
  private readonly userAgent = 'JustSteveArchiveAnalyzer/2.0 (TypeScript; Research)';

  /**
   * Creates a new WaybackAPIService instance
   * @param logger - LoggingService instance for error/debug logging
   * @param requestDelay - Delay between requests in milliseconds (default: 2000)
   */
  constructor(logger: LoggingService, private readonly requestDelay: number = 2000) {
    this.logger = logger;

    // Configure axios client with proper headers and timeout
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    // Add response interceptor for error logging
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.logger.error('CDX API request failed', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch CDX records for a domain or URL
   * @param options - Query options
   * @returns Array of CDX records
   */
  async fetchCDXRecords(options: CDXQueryOptions): Promise<CDXRecord[]> {
    const { url, collapse = 'digest', output = 'text', filter, from, to } = options;

    try {
      this.logger.info(`Fetching CDX data for ${url}`, {
        collapse,
        filter,
        from,
        to,
      });

      const params: Record<string, string> = {
        url,
        collapse,
        output,
      };

      if (filter) params.filter = filter;
      if (from) params.from = from;
      if (to) params.to = to;

      const response = await this.client.get('', { params });

      if (response.status !== 200) {
        throw new Error(`CDX API returned status ${response.status}`);
      }

      const records = this.parseCDXResponse(response.data as string);
      this.logger.info(`Retrieved ${records.length} records for ${url}`);

      // Polite delay before next request
      if (this.requestDelay > 0) {
        await this.delay(this.requestDelay);
      }

      return records;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          this.logger.error(`Request timeout for ${url}`, error);
        } else if (error.response?.status === 429) {
          this.logger.error(`Rate limited by CDX API for ${url}`, error);
        } else {
          this.logger.error(`CDX API error for ${url}`, error);
        }
      }
      throw error;
    }
  }

  /**
   * Parse CDX API text response into CDXRecord objects
   * @param data - Raw CDX response text
   * @returns Array of parsed CDX records
   */
  private parseCDXResponse(data: string): CDXRecord[] {
    const records: CDXRecord[] = [];
    const lines = data.trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const record = this.parseCDXLine(line);
        records.push(record);
      } catch (error) {
        this.logger.warn(`Skipping invalid CDX line: ${error instanceof Error ? error.message : 'Unknown error'}`, {
          line: line.substring(0, 100),
        });
      }
    }

    return records;
  }

  /**
   * Parse a single CDX line into a CDXRecord
   * @param line - Single line from CDX response
   * @returns Parsed CDX record
   * @throws Error if line format is invalid
   */
  private parseCDXLine(line: string): CDXRecord {
    const parts = line.trim().split(/\s+/);

    if (parts.length < 7) {
      throw new Error(`Invalid CDX line format: expected at least 7 fields, got ${parts.length}`);
    }

    const [urlkey, timestamp, original, mimetype, statuscode, digest, lengthStr] = parts;

    // Validate required fields
    if (!urlkey || !timestamp || !original) {
      throw new Error('Missing required CDX fields');
    }

    // Parse length with validation
    const length = lengthStr && /^\d+$/.test(lengthStr) ? parseInt(lengthStr, 10) : 0;

    return {
      urlkey,
      timestamp,
      original,
      mimetype: mimetype || 'unknown',
      statuscode: statuscode || '200',
      digest: digest || '',
      length,
    };
  }

  /**
   * Helper method to delay execution
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch a snapshot from the Wayback Machine
   * @param url - Original URL
   * @param timestamp - Wayback timestamp (YYYYMMDDHHMMSS)
   * @returns HTML content of the archived page
   */
  async fetchSnapshot(url: string, timestamp: string): Promise<string> {
    const waybackURL = `https://web.archive.org/web/${timestamp}/${url}`;

    try {
      this.logger.debug(`Fetching snapshot: ${waybackURL}`);

      const response = await this.client.get(waybackURL, {
        baseURL: '', // Override baseURL for full wayback URL
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch snapshot: HTTP ${response.status}`);
      }

      return response.data as string;
    } catch (error) {
      this.logger.error(`Failed to fetch snapshot: ${waybackURL}`, error as Error);
      throw error;
    }
  }

  /**
   * Check if the Wayback Machine API is accessible
   * @returns True if API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('', {
        params: {
          url: 'example.com',
          limit: 1,
        },
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      this.logger.error('Wayback API health check failed', error as Error);
      return false;
    }
  }
}
