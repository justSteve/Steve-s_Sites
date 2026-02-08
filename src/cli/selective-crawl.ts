#!/usr/bin/env node
/**
 * CLI for Selective Wayback Crawler
 * Captures the first snapshot + N substantive changes for any domain
 */

import { Command } from 'commander';
import { SelectiveCrawler } from '../domain/crawler/SelectiveCrawler';

const program = new Command();

program
  .name('selective-crawl')
  .description('Selectively crawl Wayback Machine for substantive changes only')
  .requiredOption('-d, --domain <domain>', 'Domain to crawl (e.g., example.com)')
  .option('-o, --output <dir>', 'Output directory', 'archived_pages')
  .option('-n, --max-snapshots <n>', 'Max substantive snapshots after first (default: 3)', '3')
  .option('--from <date>', 'Start date filter (YYYY or YYYYMMDD)')
  .option('--to <date>', 'End date filter (YYYY or YYYYMMDD)')
  .option('--size-threshold <percent>', 'Min size change % for substantive (default: 30)', '30')
  .option('--time-threshold <days>', 'Days for time-based substantive (default: 180)', '180')
  .option('--time-size <percent>', 'Min size change % with time factor (default: 15)', '15')
  .option('--no-delay', 'Disable request delays (not recommended)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const crawler = new SelectiveCrawler({
      domain: options.domain,
      outputDir: options.output,
      noDelay: !options.delay,
      verbose: options.verbose,
      fromDate: options.from,
      toDate: options.to,
      config: {
        maxSubstantiveSnapshots: parseInt(options.maxSnapshots, 10),
        minSizeChangePercent: parseInt(options.sizeThreshold, 10),
        daysForTimeBasedChange: parseInt(options.timeThreshold, 10),
        minSizeChangeWithTime: parseInt(options.timeSize, 10),
      },
    });

    try {
      const result = await crawler.run();

      if (result.snapshotsCaptured.length === 0) {
        console.log('\nNo snapshots found for this domain.');
      } else {
        console.log('\nCaptured snapshots:');
        result.snapshotsCaptured.forEach((snap, i) => {
          const date = snap.timestamp.slice(0, 4) + '-' +
                       snap.timestamp.slice(4, 6) + '-' +
                       snap.timestamp.slice(6, 8);
          console.log(`  ${i + 1}. ${date} [${snap.captureReason}]`);
          if (snap.changeDetails) {
            console.log(`     Size change: ${snap.changeDetails.sizeChangePercent.toFixed(1)}%`);
            console.log(`     Days since previous: ${snap.changeDetails.daysElapsed}`);
          }
        });
      }

      crawler.close();
      process.exit(0);
    } catch (error) {
      console.error('\nCrawl failed:', (error as Error).message);
      crawler.close();
      process.exit(1);
    }
  });

program.parse();
