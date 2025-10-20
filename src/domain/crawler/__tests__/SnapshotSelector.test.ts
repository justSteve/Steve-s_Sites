/**
 * Tests for SnapshotSelector service
 */

import { SnapshotSelector } from '../SnapshotSelector';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

describe('SnapshotSelector', () => {
  let selector: SnapshotSelector;
  let testDbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    // Create temporary test database
    testDbPath = path.join(__dirname, 'test-selector.db');
    db = new Database(testDbPath);

    // Create schema
    db.exec(`
      CREATE TABLE snapshots (
        id INTEGER PRIMARY KEY,
        domain TEXT,
        url TEXT,
        timestamp TEXT,
        year INTEGER,
        statuscode TEXT,
        mimetype TEXT,
        digest TEXT,
        length INTEGER,
        is_unique_content BOOLEAN,
        is_significant_change BOOLEAN,
        change_score REAL
      )
    `);

    // Insert test data
    const insert = db.prepare(`
      INSERT INTO snapshots (domain, url, timestamp, year, statuscode, mimetype, digest, length, is_unique_content, is_significant_change, change_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Domain: test.com
    insert.run('test.com', 'http://test.com', '20100101000000', 2010, '200', 'text/html', 'abc123', 1000, 1, 0, 10);
    insert.run('test.com', 'http://test.com', '20100615000000', 2010, '200', 'text/html', 'def456', 2000, 1, 1, 75);
    insert.run('test.com', 'http://test.com', '20110301000000', 2011, '200', 'text/html', 'ghi789', 3000, 1, 1, 150);
    insert.run('test.com', 'http://test.com', '20120801000000', 2012, '200', 'text/html', 'jkl012', 1500, 1, 0, 25);
    insert.run('test.com', 'http://test.com', '20130501000000', 2013, '200', 'text/html', 'mno345', 2500, 1, 1, 90);

    selector = new SnapshotSelector(testDbPath);
  });

  afterEach(() => {
    selector.close();
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('selectAllUnique', () => {
    it('should select all unique content snapshots', () => {
      const results = selector.selectAllUnique('test.com');

      expect(results).toHaveLength(5);
      expect(results[0].timestamp).toBe('20100101000000');
      expect(results[4].timestamp).toBe('20130501000000');
    });

    it('should return empty array for non-existent domain', () => {
      const results = selector.selectAllUnique('nonexistent.com');
      expect(results).toHaveLength(0);
    });
  });

  describe('selectSignificantOnly', () => {
    it('should select snapshots above threshold', () => {
      const results = selector.selectSignificantOnly('test.com', 50);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.change_score >= 50)).toBe(true);
    });

    it('should use default threshold of 50', () => {
      const results = selector.selectSignificantOnly('test.com');

      expect(results).toHaveLength(3);
    });

    it('should return all if threshold is 0', () => {
      const results = selector.selectSignificantOnly('test.com', 0);

      expect(results).toHaveLength(5);
    });
  });

  describe('selectOnePerYear', () => {
    it('should select one snapshot per year', () => {
      const results = selector.selectOnePerYear('test.com');

      expect(results).toHaveLength(4); // 2010, 2011, 2012, 2013
      expect(results.map(r => r.year)).toEqual([2010, 2011, 2012, 2013]);
    });

    it('should select highest change score per year', () => {
      const results = selector.selectOnePerYear('test.com');

      const year2010 = results.find(r => r.year === 2010);
      expect(year2010?.change_score).toBe(75); // Should pick the one with score 75, not 10
    });
  });

  describe('selectTopN', () => {
    it('should select top N by change score', () => {
      const results = selector.selectTopN('test.com', 3);

      expect(results).toHaveLength(3);
      expect(results[0].change_score).toBe(150);
      expect(results[1].change_score).toBe(90);
      expect(results[2].change_score).toBe(75);
    });

    it('should use default N of 10', () => {
      const results = selector.selectTopN('test.com');

      expect(results).toHaveLength(5); // Only 5 total
    });
  });

  describe('selectByYears', () => {
    it('should select snapshots from specific years', () => {
      const results = selector.selectByYears('test.com', [2010, 2012]);

      expect(results).toHaveLength(3); // 2 from 2010, 1 from 2012
      expect(results.every(r => r.year === 2010 || r.year === 2012)).toBe(true);
    });

    it('should return empty for years with no data', () => {
      const results = selector.selectByYears('test.com', [2020, 2021]);

      expect(results).toHaveLength(0);
    });
  });

  describe('selectDateRange', () => {
    it('should select snapshots within date range', () => {
      const results = selector.selectDateRange('test.com', '20100601000000', '20120901000000');

      expect(results).toHaveLength(3); // June 2010, March 2011, and Aug 2012
    });

    it('should include boundary dates', () => {
      const results = selector.selectDateRange('test.com', '20100101000000', '20100101000000');

      expect(results).toHaveLength(1);
    });
  });

  describe('exportSelection', () => {
    it('should export snapshots to file', () => {
      const outputPath = path.join(__dirname, 'test-export.txt');
      const snapshots = selector.selectTopN('test.com', 2);

      selector.exportSelection(snapshots, outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      const lines = content.split('\n').filter(l => !l.startsWith('#') && l.trim());

      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('|http://test.com');

      fs.unlinkSync(outputPath);
    });
  });

  describe('select', () => {
    it('should route to correct strategy - all', () => {
      const results = selector.select({
        domain: 'test.com',
        strategy: 'all'
      });

      expect(results).toHaveLength(5);
    });

    it('should route to correct strategy - significant', () => {
      const results = selector.select({
        domain: 'test.com',
        strategy: 'significant',
        threshold: 80
      });

      expect(results).toHaveLength(2);
    });

    it('should route to correct strategy - yearly', () => {
      const results = selector.select({
        domain: 'test.com',
        strategy: 'yearly'
      });

      expect(results).toHaveLength(4);
    });

    it('should route to correct strategy - top', () => {
      const results = selector.select({
        domain: 'test.com',
        strategy: 'top',
        topN: 2
      });

      expect(results).toHaveLength(2);
    });

    it('should route to correct strategy - years', () => {
      const results = selector.select({
        domain: 'test.com',
        strategy: 'years',
        years: [2011, 2013]
      });

      expect(results).toHaveLength(2);
    });

    it('should route to correct strategy - daterange', () => {
      const results = selector.select({
        domain: 'test.com',
        strategy: 'daterange',
        startDate: '20110101000000',
        endDate: '20111231000000'
      });

      expect(results).toHaveLength(1);
    });

    it('should throw error for years strategy without years array', () => {
      expect(() => {
        selector.select({
          domain: 'test.com',
          strategy: 'years'
        });
      }).toThrow('Years array required');
    });

    it('should throw error for daterange strategy without dates', () => {
      expect(() => {
        selector.select({
          domain: 'test.com',
          strategy: 'daterange'
        });
      }).toThrow('Start and end dates required');
    });
  });
});
