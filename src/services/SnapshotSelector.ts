/**
 * Snapshot Selection Tool
 * Helps prioritize which snapshots to download based on various criteria
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';

interface SnapshotRecord {
  timestamp: string;
  url: string;
  digest: string;
  length: number;
  change_score: number;
  year?: number;
}

export type SelectionStrategy =
  | 'all'
  | 'significant'
  | 'yearly'
  | 'top'
  | 'years'
  | 'daterange';

export interface SelectionOptions {
  domain: string;
  strategy: SelectionStrategy;
  threshold?: number;
  topN?: number;
  years?: number[];
  startDate?: string;
  endDate?: string;
}

/**
 * Select priority snapshots for downloading
 */
export class SnapshotSelector {
  private db: Database.Database;

  constructor(dbPath: string = 'cdx_analysis.db') {
    this.db = new Database(dbPath);
  }

  /**
   * Select all unique content versions (default strategy)
   */
  selectAllUnique(domain: string): SnapshotRecord[] {
    const stmt = this.db.prepare(`
      SELECT timestamp, url, digest, length, change_score
      FROM snapshots
      WHERE domain = ? AND is_unique_content = 1
      ORDER BY timestamp
    `);

    const results = stmt.all(domain) as any[];
    return results.map(row => ({
      timestamp: row.timestamp,
      url: row.url,
      digest: row.digest,
      length: row.length,
      change_score: row.change_score
    }));
  }

  /**
   * Select only snapshots with significant changes
   */
  selectSignificantOnly(domain: string, threshold: number = 50.0): SnapshotRecord[] {
    const stmt = this.db.prepare(`
      SELECT timestamp, url, digest, length, change_score
      FROM snapshots
      WHERE domain = ? AND change_score >= ?
      ORDER BY timestamp
    `);

    const results = stmt.all(domain, threshold) as any[];
    return results.map(row => ({
      timestamp: row.timestamp,
      url: row.url,
      digest: row.digest,
      length: row.length,
      change_score: row.change_score
    }));
  }

  /**
   * Select one representative snapshot per year (highest change score)
   */
  selectOnePerYear(domain: string): SnapshotRecord[] {
    const stmt = this.db.prepare(`
      SELECT timestamp, url, digest, length, change_score, year
      FROM snapshots
      WHERE domain = ?
      GROUP BY year
      HAVING change_score = MAX(change_score)
      ORDER BY year
    `);

    const results = stmt.all(domain) as any[];
    return results.map(row => ({
      timestamp: row.timestamp,
      url: row.url,
      digest: row.digest,
      length: row.length,
      change_score: row.change_score,
      year: row.year
    }));
  }

  /**
   * Select top N most significant snapshots
   */
  selectTopN(domain: string, n: number = 10): SnapshotRecord[] {
    const stmt = this.db.prepare(`
      SELECT timestamp, url, digest, length, change_score
      FROM snapshots
      WHERE domain = ?
      ORDER BY change_score DESC, timestamp ASC
      LIMIT ?
    `);

    const results = stmt.all(domain, n) as any[];
    return results.map(row => ({
      timestamp: row.timestamp,
      url: row.url,
      digest: row.digest,
      length: row.length,
      change_score: row.change_score
    }));
  }

  /**
   * Select all snapshots from specific years
   */
  selectByYears(domain: string, years: number[]): SnapshotRecord[] {
    const placeholders = years.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT timestamp, url, digest, length, change_score, year
      FROM snapshots
      WHERE domain = ? AND year IN (${placeholders})
      ORDER BY timestamp
    `);

    const results = stmt.all(domain, ...years) as any[];
    return results.map(row => ({
      timestamp: row.timestamp,
      url: row.url,
      digest: row.digest,
      length: row.length,
      change_score: row.change_score,
      year: row.year
    }));
  }

  /**
   * Select snapshots within a date range (YYYYMMDD format)
   */
  selectDateRange(domain: string, start: string, end: string): SnapshotRecord[] {
    const stmt = this.db.prepare(`
      SELECT timestamp, url, digest, length, change_score
      FROM snapshots
      WHERE domain = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp
    `);

    const results = stmt.all(domain, start, end) as any[];
    return results.map(row => ({
      timestamp: row.timestamp,
      url: row.url,
      digest: row.digest,
      length: row.length,
      change_score: row.change_score
    }));
  }

  /**
   * Export selected snapshots to a file for use by crawler
   */
  exportSelection(snapshots: SnapshotRecord[], outputFile: string): void {
    const lines: string[] = [];
    lines.push('# Selected snapshots for download');
    lines.push('# Format: timestamp|url');
    lines.push(`# Total: ${snapshots.length}`);
    lines.push('');

    snapshots.forEach(snap => {
      lines.push(`${snap.timestamp}|${snap.url}`);
    });

    fs.writeFileSync(outputFile, lines.join('\n'), 'utf-8');
    console.log(`Exported ${snapshots.length} snapshots to: ${outputFile}`);
  }

  /**
   * Print selection summary
   */
  printSelection(snapshots: SnapshotRecord[], title: string = 'Selected Snapshots'): void {
    console.log('\n' + '='.repeat(70));
    console.log(title);
    console.log('='.repeat(70));
    console.log(`Total: ${snapshots.length} snapshots\n`);

    snapshots.forEach((snap, i) => {
      const timestamp = snap.timestamp;
      const date = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
      const num = String(i + 1).padStart(3, ' ');
      const length = snap.length.toLocaleString().padStart(8, ' ');

      let line = `${num}. ${date}  ${length}b  `;

      if (snap.change_score !== undefined) {
        const score = snap.change_score.toFixed(1).padStart(6, ' ');
        line += `score: ${score}  `;
      }

      if (snap.year !== undefined) {
        line += `year: ${snap.year}`;
      }

      console.log(line);
    });

    console.log('\n' + '='.repeat(70) + '\n');
  }

  /**
   * Select snapshots based on options
   */
  select(options: SelectionOptions): SnapshotRecord[] {
    switch (options.strategy) {
      case 'all':
        return this.selectAllUnique(options.domain);

      case 'significant':
        return this.selectSignificantOnly(options.domain, options.threshold ?? 50.0);

      case 'yearly':
        return this.selectOnePerYear(options.domain);

      case 'top':
        return this.selectTopN(options.domain, options.topN ?? 10);

      case 'years':
        if (!options.years || options.years.length === 0) {
          throw new Error('Years array required for "years" strategy');
        }
        return this.selectByYears(options.domain, options.years);

      case 'daterange':
        if (!options.startDate || !options.endDate) {
          throw new Error('Start and end dates required for "daterange" strategy');
        }
        return this.selectDateRange(options.domain, options.startDate, options.endDate);

      default:
        throw new Error(`Unknown strategy: ${options.strategy}`);
    }
  }

  close(): void {
    this.db.close();
  }
}
