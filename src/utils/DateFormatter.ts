/**
 * Utility functions for date and timestamp formatting
 */

/**
 * Parse a Wayback Machine timestamp (YYYYMMDDHHMMSS) to Date
 * @param timestamp - Wayback timestamp string
 * @returns Parsed Date object
 * @throws Error if timestamp format is invalid
 */
export function parseWaybackTimestamp(timestamp: string): Date {
  if (!/^\d{14}$/.test(timestamp)) {
    throw new Error(`Invalid Wayback timestamp format: ${timestamp}`);
  }

  const year = parseInt(timestamp.substring(0, 4), 10);
  const month = parseInt(timestamp.substring(4, 6), 10) - 1; // JS months are 0-indexed
  const day = parseInt(timestamp.substring(6, 8), 10);
  const hour = parseInt(timestamp.substring(8, 10), 10);
  const minute = parseInt(timestamp.substring(10, 12), 10);
  const second = parseInt(timestamp.substring(12, 14), 10);

  const date = new Date(year, month, day, hour, minute, second);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date components in timestamp: ${timestamp}`);
  }

  return date;
}

/**
 * Format a Date object to Wayback timestamp (YYYYMMDDHHMMSS)
 * @param date - Date to format
 * @returns Wayback timestamp string
 */
export function formatWaybackTimestamp(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  const second = date.getSeconds().toString().padStart(2, '0');

  return `${year}${month}${day}${hour}${minute}${second}`;
}

/**
 * Format a Wayback timestamp to human-readable date string
 * @param timestamp - Wayback timestamp
 * @returns Formatted date string (YYYY-MM-DD HH:MM:SS)
 */
export function formatReadableDate(timestamp: string): string {
  const date = parseWaybackTimestamp(timestamp);
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Format a Wayback timestamp to short date string
 * @param timestamp - Wayback timestamp
 * @returns Formatted date string (YYYY-MM-DD)
 */
export function formatShortDate(timestamp: string): string {
  return `${timestamp.substring(0, 4)}-${timestamp.substring(4, 6)}-${timestamp.substring(6, 8)}`;
}

/**
 * Extract year from Wayback timestamp
 * @param timestamp - Wayback timestamp
 * @returns Year as number
 */
export function extractYear(timestamp: string): number {
  return parseInt(timestamp.substring(0, 4), 10);
}
