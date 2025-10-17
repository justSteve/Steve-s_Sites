/**
 * Tests for TimelineGenerator service
 */

import { TimelineGenerator } from '../TimelineGenerator';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

describe('TimelineGenerator', () => {
  let generator: TimelineGenerator;
  let testDbPath: string;
  let testOutputDir: string;
  let db: Database.Database;

  beforeEach(() => {
    // Create temporary test database
    testDbPath = path.join(__dirname, 'test-generator.db');
    testOutputDir = path.join(__dirname, 'test-reports');

    db = new Database(testDbPath);

    // Create schema
    db.exec(`
      CREATE TABLE snapshots (
        id INTEGER PRIMARY KEY,
        domain TEXT,
        url TEXT,
        timestamp TEXT,
        statuscode INTEGER,
        length INTEGER,
        change_score REAL,
        digest TEXT
      )
    `);

    // Insert test data
    const insert = db.prepare(`
      INSERT INTO snapshots (domain, url, timestamp, statuscode, length, change_score, digest)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run('test.com', 'http://test.com', '20100315120000', 200, 1000, 10, 'abc123def456');
    insert.run('test.com', 'http://test.com', '20101201183000', 200, 2000, 75, 'def456ghi789');
    insert.run('test.com', 'http://test.com', '20110520093000', 200, 3000, 150, 'ghi789jkl012');
    insert.run('another.com', 'http://another.com', '20150101000000', 200, 500, 5, 'xyz789');

    generator = new TimelineGenerator(testDbPath, testOutputDir);
  });

  afterEach(() => {
    generator.close();
    db.close();

    // Clean up
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      files.forEach(file => fs.unlinkSync(path.join(testOutputDir, file)));
      fs.rmdirSync(testOutputDir);
    }
  });

  describe('getDomains', () => {
    it('should return list of domains', () => {
      const domains = generator.getDomains();

      expect(domains).toHaveLength(2);
      expect(domains).toContain('test.com');
      expect(domains).toContain('another.com');
    });

    it('should return sorted domains', () => {
      const domains = generator.getDomains();

      expect(domains[0]).toBe('another.com');
      expect(domains[1]).toBe('test.com');
    });
  });

  describe('getTimelineData', () => {
    it('should return timeline data for domain', () => {
      const timeline = generator.getTimelineData('test.com');

      expect(timeline).toHaveLength(3);
      expect(timeline[0].timestamp).toBe('20100315120000');
      expect(timeline[0].dateStr).toBe('2010-03-15');
    });

    it('should parse timestamps correctly', () => {
      const timeline = generator.getTimelineData('test.com');

      expect(timeline[0].date).toBeInstanceOf(Date);
      expect(timeline[0].date.getFullYear()).toBe(2010);
      expect(timeline[0].date.getMonth()).toBe(2); // March = 2 (0-indexed)
      expect(timeline[0].date.getDate()).toBe(15);
    });

    it('should return empty array for non-existent domain', () => {
      const timeline = generator.getTimelineData('nonexistent.com');

      expect(timeline).toHaveLength(0);
    });

    it('should sort by timestamp', () => {
      const timeline = generator.getTimelineData('test.com');

      expect(timeline[0].timestamp).toBe('20100315120000');
      expect(timeline[1].timestamp).toBe('20101201183000');
      expect(timeline[2].timestamp).toBe('20110520093000');
    });
  });

  describe('generateHtmlTimeline', () => {
    it('should create HTML file', () => {
      generator.generateHtmlTimeline('test.com');

      const outputFile = path.join(testOutputDir, 'timeline_test_com.html');
      expect(fs.existsSync(outputFile)).toBe(true);
    });

    it('should include domain in title', () => {
      generator.generateHtmlTimeline('test.com');

      const outputFile = path.join(testOutputDir, 'timeline_test_com.html');
      const content = fs.readFileSync(outputFile, 'utf-8');

      expect(content).toContain('<title>Timeline: test.com</title>');
      expect(content).toContain('<h1>Archive Timeline: test.com</h1>');
    });

    it('should include summary statistics', () => {
      generator.generateHtmlTimeline('test.com');

      const outputFile = path.join(testOutputDir, 'timeline_test_com.html');
      const content = fs.readFileSync(outputFile, 'utf-8');

      expect(content).toContain('Total unique versions: 3');
      expect(content).toContain('2010-03-15');
      expect(content).toContain('2011-05-20');
    });

    it('should mark significant changes', () => {
      generator.generateHtmlTimeline('test.com');

      const outputFile = path.join(testOutputDir, 'timeline_test_com.html');
      const content = fs.readFileSync(outputFile, 'utf-8');

      expect(content).toContain('class="snapshot significant"'); // score 75
      expect(content).toContain('class="snapshot major"'); // score 150
    });

    it('should not create file for empty domain', () => {
      generator.generateHtmlTimeline('nonexistent.com');

      const outputFile = path.join(testOutputDir, 'timeline_nonexistent_com.html');
      expect(fs.existsSync(outputFile)).toBe(false);
    });
  });

  describe('generateTextReport', () => {
    it('should create text file', () => {
      generator.generateTextReport('test.com');

      const outputFile = path.join(testOutputDir, 'timeline_test_com.txt');
      expect(fs.existsSync(outputFile)).toBe(true);
    });

    it('should include statistics', () => {
      const output = generator.generateTextReport('test.com');

      expect(output).toContain('TIMELINE REPORT: test.com');
      expect(output).toContain('Total versions: 3');
    });

    it('should include year sections', () => {
      const output = generator.generateTextReport('test.com');

      expect(output).toContain('### 2010');
      expect(output).toContain('### 2011');
    });

    it('should mark significant changes with asterisks', () => {
      const output = generator.generateTextReport('test.com');

      expect(output).toContain('**'); // Significant change
      expect(output).toContain('***'); // Major change
    });

    it('should return empty string for non-existent domain', () => {
      const output = generator.generateTextReport('nonexistent.com');

      expect(output).toBe('');
    });
  });

  describe('generateJsonExport', () => {
    it('should create JSON file', () => {
      generator.generateJsonExport('test.com');

      const outputFile = path.join(testOutputDir, 'timeline_test_com.json');
      expect(fs.existsSync(outputFile)).toBe(true);
    });

    it('should contain valid JSON', () => {
      generator.generateJsonExport('test.com');

      const outputFile = path.join(testOutputDir, 'timeline_test_com.json');
      const content = fs.readFileSync(outputFile, 'utf-8');
      const data = JSON.parse(content);

      expect(data.domain).toBe('test.com');
      expect(data.total_versions).toBe(3);
      expect(data.timeline).toHaveLength(3);
    });

    it('should include all timeline properties', () => {
      generator.generateJsonExport('test.com');

      const outputFile = path.join(testOutputDir, 'timeline_test_com.json');
      const data = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));

      const item = data.timeline[0];
      expect(item).toHaveProperty('timestamp');
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('dateStr');
      expect(item).toHaveProperty('statuscode');
      expect(item).toHaveProperty('length');
      expect(item).toHaveProperty('change_score');
      expect(item).toHaveProperty('digest');
    });

    it('should not create file for empty domain', () => {
      generator.generateJsonExport('nonexistent.com');

      const outputFile = path.join(testOutputDir, 'timeline_nonexistent_com.json');
      expect(fs.existsSync(outputFile)).toBe(false);
    });
  });

  describe('generateAllReports', () => {
    it('should generate reports for all domains', () => {
      generator.generateAllReports();

      // Check for test.com files
      expect(fs.existsSync(path.join(testOutputDir, 'timeline_test_com.html'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'timeline_test_com.txt'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'timeline_test_com.json'))).toBe(true);

      // Check for another.com files
      expect(fs.existsSync(path.join(testOutputDir, 'timeline_another_com.html'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'timeline_another_com.txt'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'timeline_another_com.json'))).toBe(true);
    });
  });
});
