#!/usr/bin/env node
/**
 * CLI for Timeline Generator
 */

import { Command } from 'commander';
import { TimelineGenerator } from '../services/TimelineGenerator';

const program = new Command();

program
  .name('generator')
  .description('Generate visual timeline reports from CDX analysis data')
  .option('--domain <domain>', 'Generate reports for specific domain only')
  .option('--db <path>', 'Path to CDX analysis database', 'cdx_analysis.db')
  .option('--output <dir>', 'Output directory for reports', 'reports')
  .option('--html', 'Generate HTML timeline only')
  .option('--text', 'Generate text report only')
  .option('--json', 'Generate JSON export only')
  .parse(process.argv);

const options = program.opts();

const generator = new TimelineGenerator(options.db, options.output);

try {
  if (options.domain) {
    // Generate for specific domain
    console.log(`Generating reports for: ${options.domain}`);
    console.log('-'.repeat(50));

    if (options.html || (!options.html && !options.text && !options.json)) {
      generator.generateHtmlTimeline(options.domain);
    }

    if (options.text || (!options.html && !options.text && !options.json)) {
      generator.generateTextReport(options.domain);
    }

    if (options.json || (!options.html && !options.text && !options.json)) {
      generator.generateJsonExport(options.domain);
    }
  } else {
    // Generate for all domains
    generator.generateAllReports();
  }

  generator.close();
} catch (err: any) {
  console.error('Error:', err.message);
  generator.close();
  process.exit(1);
}
