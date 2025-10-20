#!/usr/bin/env node
/**
 * CLI for Wayback Machine Crawler
 */

import { Command } from 'commander';
import { WaybackCrawler } from '../domain/crawler/WaybackCrawler';

const program = new Command();

program
  .name('crawler')
  .description('Wayback Machine Archive Crawler with full asset fetching')
  .option('--snapshots <file>', 'Path to snapshot selection file')
  .option('--no-scheduler', 'Disable off-peak hours scheduler (run continuously)')
  .option('--no-delay', 'Disable ALL delays (scheduler + request delays)')
  .option('--off-peak-start <time>', 'Off-peak start time (format: HH:MM)', '22:00')
  .option('--off-peak-end <time>', 'Off-peak end time (format: HH:MM)', '06:00')
  .option('--page-delay-min <seconds>', 'Min delay between pages (seconds)', '30')
  .option('--page-delay-max <seconds>', 'Max delay between pages (seconds)', '120')
  .option('--no-fetch-assets', 'Disable asset fetching (HTML only)')
  .option('--no-external-assets', 'Skip external domain assets')
  .option('--max-asset-size <mb>', 'Max asset size in MB', '50')
  .option('--asset-concurrency <n>', 'Parallel asset downloads', '10')
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
  useOffPeakScheduler: options.scheduler && options.delay,
  noDelay: !options.delay,
  offPeakStart: parseTime(options.offPeakStart),
  offPeakEnd: parseTime(options.offPeakEnd),
  minDelaySeconds: parseInt(options.pageDelayMin),
  maxDelaySeconds: parseInt(options.pageDelayMax),
  fetchAssets: options.fetchAssets !== false,
  fetchExternalAssets: options.externalAssets !== false,
  maxAssetSizeMB: parseInt(options.maxAssetSize),
  assetConcurrency: parseInt(options.assetConcurrency),
  outputDir: options.output
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down crawler...');
  process.exit(0);
});

// Log configuration
console.log('Starting Wayback Machine crawler...');
console.log(`Configuration:
  - Snapshots file: ${options.snapshots}
  - No delay mode: ${!options.delay ? 'YES' : 'NO'}
  - Scheduler: ${options.scheduler && options.delay ? 'ENABLED' : 'DISABLED'}
  - Fetch assets: ${options.fetchAssets !== false ? 'YES' : 'NO'}
  - External assets: ${options.externalAssets !== false ? 'YES' : 'NO'}
  - Max asset size: ${options.maxAssetSize}MB
  - Asset concurrency: ${options.assetConcurrency}
`);

crawler.run().catch(err => {
  console.error('Crawler error:', err);
  process.exit(1);
});
