// src/models/AssetTypes.ts

/**
 * Types of web assets that can be fetched
 */
export type AssetType = 'css' | 'js' | 'image' | 'font' | 'video' | 'audio' | 'other';

/**
 * Reference to an asset discovered in HTML or CSS
 */
export interface AssetReference {
  /** Full URL of the asset */
  url: string;
  /** Type of asset */
  type: AssetType;
  /** Source file where this asset was referenced */
  sourceFile: string;
  /** Whether this asset is from an external domain */
  isExternal: boolean;
  /** Line number in source file (optional) */
  lineNumber?: number;
}

/**
 * Record of an asset that was skipped during fetching
 */
export interface SkippedAsset {
  /** Original URL of the asset */
  url: string;
  /** Reason for skipping */
  reason: 'size_limit' | 'fetch_error' | 'invalid_type';
  /** Size in MB (if known) */
  sizeMB?: number;
  /** Wayback Machine URL for manual download */
  waybackUrl: string;
  /** Error message (if applicable) */
  error?: string;
}

/**
 * Statistics about assets for a snapshot
 */
export interface AssetStats {
  /** Total number of assets */
  total: number;
  /** Assets grouped by type */
  byType: Record<string, number>;
  /** Total size in MB */
  totalSizeMB: number;
  /** List of external domains referenced */
  externalDomains: string[];
}

/**
 * Complete manifest of a crawled snapshot with assets
 */
export interface AssetManifest {
  /** Domain being archived */
  domain: string;
  /** Wayback timestamp */
  timestamp: string;
  /** When this was crawled */
  crawledAt: string;
  /** List of HTML pages */
  pages: string[];
  /** Asset statistics */
  assets: AssetStats;
  /** Number of skipped assets */
  skippedCount: number;
}
