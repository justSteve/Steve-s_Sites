#!/usr/bin/env node
/**
 * CLI entry point for CDX Analyzer
 * Analyzes Wayback Machine snapshot history for configured domains
 */

import { Command } from 'commander';
import { CDXAnalyzerController } from '../controllers/CDXAnalyzerController';
import { resolve } from 'path';

const program = new Command();

program
  .name('cdx-analyzer')
  .description('Analyze Wayback Machine CDX data for configured domains')
  .version('2.0.0');

program
  .option('-c, --config <path>', 'Path to domains config file', 'domains.json')
  .option('-d, --database <path>', 'Path to database file', 'cdx_analysis.db')
  .option('-l, --log <path>', 'Path to log file', 'logs/cdx_analyzer.log')
  .option('--delay <ms>', 'Delay between API requests in milliseconds', '2000')
  .option('--report-only', 'Only generate reports, skip analysis')
  .action(async (options) => {
    const config = {
      domainsConfigPath: resolve(options.config),
      dbPath: resolve(options.database),
      logPath: resolve(options.log),
      requestDelay: parseInt(options.delay, 10),
    };

    const controller = new CDXAnalyzerController(config);

    try {
      if (options.reportOnly) {
        console.log('Generating reports from existing data...\n');
        await controller.generateAllReports();
      } else {
        console.log('Starting CDX analysis...\n');
        await controller.analyzeAllDomains();
        console.log('\nGenerating reports...\n');
        await controller.generateAllReports();
      }

      console.log('\n✓ Analysis complete!');
      await controller.close();
      process.exit(0);
    } catch (error) {
      console.error('\n✗ Analysis failed:', (error as Error).message);
      await controller.close();
      process.exit(1);
    }
  });

program.parse();
