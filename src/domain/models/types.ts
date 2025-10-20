/**
 * Core type definitions for the Wayback Archive Toolkit
 */

/**
 * Represents a domain configuration
 */
export interface DomainConfig {
  name: string;
  activeYears: string;
  priority: 'low' | 'medium' | 'high';
  notes: string;
}

/**
 * Domain configuration file structure
 */
export interface DomainsConfigFile {
  domains: DomainConfig[];
  notes?: string;
}

/**
 * Represents a CDX record from the Wayback Machine API
 */
export interface CDXRecord {
  urlkey: string;
  timestamp: string;
  original: string;
  mimetype: string;
  statuscode: string;
  digest: string;
  length: number;
}

/**
 * Represents a snapshot in the database
 */
export interface Snapshot {
  id?: number;
  domain: string;
  url: string;
  timestamp: string;
  year: number;
  statuscode: string;
  mimetype: string;
  digest: string;
  length: number;
  isUniqueContent: boolean;
  isSignificantChange: boolean;
  changeScore: number;
}

/**
 * Domain statistics summary
 */
export interface DomainStats {
  domain: string;
  totalSnapshots: number;
  uniqueVersions: number;
  yearsCovered: number;
  firstSnapshot: string;
  lastSnapshot: string;
  avgSize: number;
  maxSize: number;
}

/**
 * Yearly breakdown statistics
 */
export interface YearlyStats {
  year: number;
  snapshots: number;
  uniqueVersions: number;
  avgSize: number;
  maxSize: number;
  statusCodes: string;
}

/**
 * Timeline data item for visualization
 */
export interface TimelineItem {
  timestamp: string;
  date: Date;
  dateStr: string;
  statuscode: string;
  length: number;
  changeScore: number;
  digest: string;
  url: string;
}

/**
 * Crawler URL queue item
 */
export interface CrawlerURL {
  url: string;
  timestamp: string;
  domain: string;
  status: 'pending' | 'completed' | 'failed';
  localPath?: string;
  discoveredAt: Date;
  fetchedAt?: Date;
  error?: string;
}

/**
 * Crawler statistics
 */
export interface CrawlerStats {
  pending: number;
  completed: number;
  failed: number;
}

/**
 * Snapshot selection strategy options
 */
export type SelectionStrategy =
  | 'all'
  | 'significant'
  | 'yearly'
  | 'top'
  | 'years'
  | 'daterange';

/**
 * Snapshot selection criteria
 */
export interface SelectionCriteria {
  strategy: SelectionStrategy;
  threshold?: number;
  topN?: number;
  years?: number[];
  startDate?: string;
  endDate?: string;
}

/**
 * Beads issue structure
 */
export interface BeadsIssue {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: number;
  issueType: string;
  labels?: string[];
  assignee?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Beads dependency types
 */
export type BeadsDependencyType =
  | 'blocks'
  | 'related'
  | 'parent-child'
  | 'discovered-from';

/**
 * Logging levels
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Configuration for the crawler
 */
export interface CrawlerConfig {
  offPeakStart: { hour: number; minute: number };
  offPeakEnd: { hour: number; minute: number };
  minDelaySeconds: number;
  maxDelaySeconds: number;
  outputDir: string;
  dbFile: string;
  logFile: string;
}

/**
 * Configuration for CDX analyzer
 */
export interface CDXAnalyzerConfig {
  domainsConfig: string;
  cdxDB: string;
  cdxAPIBase: string;
  logFile: string;
  requestDelay: number;
}
