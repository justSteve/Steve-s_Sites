#!/usr/bin/env node
/**
 * CLI for Wayback Machine Crawler
 */

import { Command } from 'commander';
import { WaybackCrawler } from '../services/WaybackCrawler';

const program = new Command();

program
  .name('crawler')
  .description('Wayback Machine Archive Crawler')
  .option('--snapshots <file>', 'Path to snapshot selection file')
  .option('--no-scheduler', 'Disable off-peak hours scheduler (run continuously)')
  .option('--off-peak-start <time>', 'Off-peak start time (format: HH:MM)', '22:00')
  .option('--off-peak-end <time>', 'Off-peak end time (format: HH:MM)', '06:00')
  .option('--min-delay <seconds>', 'Minimum delay between requests (seconds)', '30')
  .option('--max-delay <seconds>', 'Maximum delay between requests (seconds)', '120')
  .option('--output <dir>', 'Output directory for archived pages', 'archived_pages')
  .parse(process.argv);

const options = program.opts();

// Parse time strings
const parseTime = (timeStr: string) => {
  const [hour, minute] = timeStr.split(':').map(n => parseInt(n));
  return { hour, minute };
};

const crawler = new WaybackCrawler({
  snapshotListFile: options.snapshots,
  useOffPeakScheduler: options.scheduler,
  offPeakStart: parseTime(options.offPeakStart),
  offPeakEnd: parseTime(options.offPeakEnd),
  minDelaySeconds: parseInt(options.minDelay),
  maxDelaySeconds: parseInt(options.maxDelay),
  outputDir: options.output
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down crawler...');
  process.exit(0);
});

crawler.run().catch(err => {
  console.error('Crawler error:', err);
  process.exit(1);
});
