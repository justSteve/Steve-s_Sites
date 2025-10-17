/**
 * Tests for DateFormatter utility
 */

import * as DateFormatter from '../DateFormatter';

describe('DateFormatter', () => {
  describe('parseWaybackTimestamp', () => {
    it('should parse valid timestamp', () => {
      const date = DateFormatter.parseWaybackTimestamp('20100315120530');

      expect(date.getFullYear()).toBe(2010);
      expect(date.getMonth()).toBe(2); // March = 2 (0-indexed)
      expect(date.getDate()).toBe(15);
      expect(date.getHours()).toBe(12);
      expect(date.getMinutes()).toBe(5);
      expect(date.getSeconds()).toBe(30);
    });

    it('should handle midnight timestamps', () => {
      const date = DateFormatter.parseWaybackTimestamp('20100101000000');

      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    });

    it('should handle end of year', () => {
      const date = DateFormatter.parseWaybackTimestamp('20101231235959');

      expect(date.getMonth()).toBe(11); // December = 11
      expect(date.getDate()).toBe(31);
    });
  });

  describe('formatWaybackTimestamp', () => {
    it('should convert date to Wayback timestamp format', () => {
      const date = new Date(2010, 2, 15, 12, 5, 30); // March 15, 2010, 12:05:30

      const formatted = DateFormatter.formatWaybackTimestamp(date);

      expect(formatted).toBe('20100315120530');
    });

    it('should pad single digit values', () => {
      const date = new Date(2010, 0, 5, 8, 3, 7); // Jan 5, 2010, 08:03:07

      const formatted = DateFormatter.formatWaybackTimestamp(date);

      expect(formatted).toBe('20100105080307');
    });
  });

  describe('extractYear', () => {
    it('should extract year from timestamp', () => {
      const year = DateFormatter.extractYear('20100315120530');

      expect(year).toBe(2010);
    });

    it('should work with different years', () => {
      expect(DateFormatter.extractYear('19970101000000')).toBe(1997);
      expect(DateFormatter.extractYear('20251231235959')).toBe(2025);
    });
  });

  describe('formatReadableDate', () => {
    it('should format timestamp as human readable', () => {
      const formatted = DateFormatter.formatReadableDate('20100315120530');

      expect(formatted).toContain('2010');
      expect(formatted).toContain('03');
      expect(formatted).toContain('15');
    });
  });

  describe('formatShortDate', () => {
    it('should format timestamp as short date', () => {
      const formatted = DateFormatter.formatShortDate('20100315120530');

      expect(formatted).toBe('2010-03-15');
    });
  });
});
