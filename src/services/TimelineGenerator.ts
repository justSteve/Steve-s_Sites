/**
 * Generate visual timeline reports from CDX analysis data
 * Creates HTML and text-based visualizations of domain change history
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

interface TimelineItem {
  timestamp: string;
  date: Date;
  dateStr: string;
  statuscode: number;
  length: number;
  change_score: number;
  digest: string;
  url: string;
}

/**
 * Generates timeline visualizations from CDX data
 */
export class TimelineGenerator {
  private db: Database.Database;
  private outputDir: string;

  constructor(dbPath: string = 'cdx_analysis.db', outputDir: string = 'reports') {
    this.db = new Database(dbPath);
    this.outputDir = outputDir;

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Get list of analyzed domains
   */
  getDomains(): string[] {
    const stmt = this.db.prepare(
      'SELECT DISTINCT domain FROM snapshots ORDER BY domain'
    );
    const results = stmt.all() as any[];
    return results.map(row => row.domain);
  }

  /**
   * Get timeline data for a domain
   */
  getTimelineData(domain: string): TimelineItem[] {
    const stmt = this.db.prepare(`
      SELECT timestamp, statuscode, length, change_score, digest, url
      FROM snapshots
      WHERE domain = ?
      ORDER BY timestamp
    `);

    const results = stmt.all(domain) as any[];
    return results.map(row => {
      const date = this.parseTimestamp(row.timestamp);
      return {
        timestamp: row.timestamp,
        date,
        dateStr: this.formatDate(date),
        statuscode: row.statuscode,
        length: row.length,
        change_score: row.change_score,
        digest: row.digest,
        url: row.url
      };
    });
  }

  /**
   * Parse timestamp string to Date
   */
  private parseTimestamp(timestamp: string): Date {
    const year = parseInt(timestamp.slice(0, 4));
    const month = parseInt(timestamp.slice(4, 6)) - 1;
    const day = parseInt(timestamp.slice(6, 8));
    const hour = parseInt(timestamp.slice(8, 10));
    const minute = parseInt(timestamp.slice(10, 12));
    const second = parseInt(timestamp.slice(12, 14));
    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Generate HTML timeline visualization
   */
  generateHtmlTimeline(domain: string): void {
    const timeline = this.getTimelineData(domain);
    if (timeline.length === 0) {
      return;
    }

    // Calculate year spans
    const years = [...new Set(timeline.map(item => item.date.getFullYear()))].sort();
    const yearRange = years[years.length - 1] - years[0] + 1;

    // Group by year
    const byYear: { [year: number]: TimelineItem[] } = {};
    timeline.forEach(item => {
      const year = item.date.getFullYear();
      if (!byYear[year]) {
        byYear[year] = [];
      }
      byYear[year].push(item);
    });

    const html = this.buildHtmlDocument(domain, timeline, byYear, yearRange);

    const outputFile = path.join(this.outputDir, `timeline_${domain.replace(/\./g, '_')}.html`);
    fs.writeFileSync(outputFile, html, 'utf-8');
    console.log(`Generated: ${outputFile}`);
  }

  /**
   * Build HTML document
   */
  private buildHtmlDocument(
    domain: string,
    timeline: TimelineItem[],
    byYear: { [year: number]: TimelineItem[] },
    yearRange: number
  ): string {
    const css = this.getHtmlStyles();
    const summary = this.buildHtmlSummary(domain, timeline, yearRange);
    const legend = this.buildHtmlLegend();
    const timelineHtml = this.buildHtmlTimeline(byYear);

    return `<!DOCTYPE html>
<html>
<head>
    <title>Timeline: ${domain}</title>
    <style>${css}</style>
</head>
<body>
    <h1>Archive Timeline: ${domain}</h1>
    ${summary}
    ${legend}
    <div class="timeline">
${timelineHtml}    </div>
</body>
</html>
`;
  }

  /**
   * Get HTML styles
   */
  private getHtmlStyles(): string {
    return `
        body {
            font-family: 'Courier New', monospace;
            margin: 20px;
            background: #0a0a0a;
            color: #00ff00;
        }
        h1 {
            border-bottom: 2px solid #00ff00;
            padding-bottom: 10px;
        }
        .summary {
            background: #1a1a1a;
            padding: 15px;
            margin: 20px 0;
            border-left: 4px solid #00ff00;
        }
        .timeline {
            margin: 30px 0;
        }
        .year-section {
            margin: 20px 0;
            border-left: 2px solid #333;
            padding-left: 20px;
        }
        .year-header {
            font-size: 1.5em;
            color: #00ffff;
            margin-bottom: 10px;
        }
        .snapshot {
            padding: 10px;
            margin: 5px 0;
            background: #1a1a1a;
            border-left: 4px solid #666;
        }
        .snapshot.significant {
            border-left-color: #ff6600;
            background: #2a1a0a;
        }
        .snapshot.major {
            border-left-color: #ff0000;
            background: #2a0a0a;
        }
        .date {
            color: #888;
            font-size: 0.9em;
        }
        .status-200 { color: #00ff00; }
        .status-302 { color: #ffff00; }
        .status-403, .status-404, .status-500 { color: #ff0000; }
        .size {
            color: #00aaff;
        }
        .score {
            color: #ff6600;
            font-weight: bold;
        }
        .legend {
            background: #1a1a1a;
            padding: 15px;
            margin: 20px 0;
        }
        .legend-item {
            display: inline-block;
            margin-right: 20px;
        }
        .legend-box {
            display: inline-block;
            width: 20px;
            height: 10px;
            margin-right: 5px;
        }
    `;
  }

  /**
   * Build HTML summary section
   */
  private buildHtmlSummary(domain: string, timeline: TimelineItem[], yearRange: number): string {
    return `
    <div class="summary">
        <strong>Summary:</strong><br>
        Total unique versions: ${timeline.length}<br>
        Date range: ${timeline[0].dateStr} to ${timeline[timeline.length - 1].dateStr}<br>
        Years covered: ${yearRange}<br>
    </div>`;
  }

  /**
   * Build HTML legend
   */
  private buildHtmlLegend(): string {
    return `
    <div class="legend">
        <div class="legend-item">
            <span class="legend-box" style="background: #666;"></span> Regular update
        </div>
        <div class="legend-item">
            <span class="legend-box" style="background: #ff6600;"></span> Significant change
        </div>
        <div class="legend-item">
            <span class="legend-box" style="background: #ff0000;"></span> Major change
        </div>
    </div>`;
  }

  /**
   * Build HTML timeline content
   */
  private buildHtmlTimeline(byYear: { [year: number]: TimelineItem[] }): string {
    let html = '';
    const years = Object.keys(byYear)
      .map(y => parseInt(y))
      .sort();

    for (const year of years) {
      html += `        <div class="year-section">\n`;
      html += `            <div class="year-header">${year}</div>\n`;

      for (const item of byYear[year]) {
        let significance = '';
        if (item.change_score > 100) {
          significance = 'major';
        } else if (item.change_score > 50) {
          significance = 'significant';
        }

        const statusClass = `status-${item.statuscode}`;

        html += `            <div class="snapshot ${significance}">\n`;
        html += `                <span class="date">${item.dateStr}</span> `;
        html += `<span class="${statusClass}">[${item.statuscode}]</span> `;
        html += `<span class="size">${item.length.toLocaleString()}b</span>`;

        if (item.change_score > 0) {
          html += ` <span class="score">Δ${item.change_score.toFixed(0)}</span>`;
        }

        html += `\n`;
        html += `                <div style="font-size: 0.8em; color: #666; margin-top: 5px;">${item.digest.slice(
          0,
          16
        )}...</div>\n`;
        html += `            </div>\n`;
      }

      html += `        </div>\n`;
    }

    return html;
  }

  /**
   * Generate text-based timeline report
   */
  generateTextReport(domain: string): string {
    const timeline = this.getTimelineData(domain);
    if (timeline.length === 0) {
      return '';
    }

    const output: string[] = [];
    output.push('='.repeat(70));
    output.push(`TIMELINE REPORT: ${domain}`);
    output.push('='.repeat(70));
    output.push('');
    output.push(`Total versions: ${timeline.length}`);
    output.push(
      `Date range: ${timeline[0].dateStr} to ${timeline[timeline.length - 1].dateStr}`
    );
    output.push('');
    output.push('='.repeat(70));
    output.push('');

    // Group by year
    const byYear: { [year: number]: TimelineItem[] } = {};
    timeline.forEach(item => {
      const year = item.date.getFullYear();
      if (!byYear[year]) {
        byYear[year] = [];
      }
      byYear[year].push(item);
    });

    const years = Object.keys(byYear)
      .map(y => parseInt(y))
      .sort();

    for (const year of years) {
      output.push(`\n### ${year} (${byYear[year].length} versions) ###`);
      output.push('-'.repeat(70));

      for (const item of byYear[year]) {
        let marker = ' ';
        if (item.change_score > 100) {
          marker = '***';
        } else if (item.change_score > 50) {
          marker = '**';
        } else if (item.change_score > 0) {
          marker = '*';
        }

        let line = `${marker.padStart(3, ' ')} ${item.dateStr} [${item.statuscode}] ${String(
          item.length
        ).padStart(8, ' ')}b`;
        if (item.change_score > 0) {
          line += `  (change: ${item.change_score.toFixed(0)})`;
        }

        output.push(line);
      }
    }

    output.push('');
    output.push('='.repeat(70));
    output.push('Legend: * = change, ** = significant, *** = major');
    output.push('='.repeat(70));

    const outputText = output.join('\n');
    const outputFile = path.join(this.outputDir, `timeline_${domain.replace(/\./g, '_')}.txt`);
    fs.writeFileSync(outputFile, outputText, 'utf-8');
    console.log(`Generated: ${outputFile}`);

    return outputText;
  }

  /**
   * Export timeline data as JSON
   */
  generateJsonExport(domain: string): void {
    const timeline = this.getTimelineData(domain);
    if (timeline.length === 0) {
      return;
    }

    // Convert Date objects to ISO strings for JSON serialization
    const timelineForJson = timeline.map(item => ({
      ...item,
      date: item.date.toISOString()
    }));

    const data = {
      domain,
      total_versions: timeline.length,
      timeline: timelineForJson
    };

    const outputFile = path.join(this.outputDir, `timeline_${domain.replace(/\./g, '_')}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Generated: ${outputFile}`);
  }

  /**
   * Generate all report formats for all domains
   */
  generateAllReports(): void {
    const domains = this.getDomains();

    if (domains.length === 0) {
      console.log('No domains found in database. Run cdx_analyzer.py first.');
      return;
    }

    console.log(`Generating reports for ${domains.length} domain(s)...\n`);

    for (const domain of domains) {
      console.log(`\nProcessing: ${domain}`);
      console.log('-'.repeat(50));
      this.generateHtmlTimeline(domain);
      this.generateTextReport(domain);
      this.generateJsonExport(domain);
    }

    console.log(`\n\nAll reports saved to: ${this.outputDir}/`);
    console.log('\nOpen HTML files in a browser for interactive timeline visualization.');
  }

  close(): void {
    this.db.close();
  }
}
