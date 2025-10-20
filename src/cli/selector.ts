#!/usr/bin/env node
/**
 * CLI for Snapshot Selector
 */

import { Command } from 'commander';
import { SnapshotSelector, SelectionStrategy } from '../domain/crawler/SnapshotSelector';

const program = new Command();

program
  .name('selector')
  .description('Select priority snapshots for download')
  .argument('<domain>', 'Domain to select snapshots from')
  .option(
    '--strategy <strategy>',
    'Selection strategy: all, significant, yearly, top, years, daterange',
    'all'
  )
  .option('--threshold <number>', 'Change score threshold for "significant" strategy', '50.0')
  .option('--top-n <number>', 'Number of snapshots for "top" strategy', '10')
  .option('--years <years...>', 'Specific years for "years" strategy (space-separated)')
  .option('--start <date>', 'Start date for "daterange" strategy (YYYYMMDD)')
  .option('--end <date>', 'End date for "daterange" strategy (YYYYMMDD)')
  .option('--export <file>', 'Export selection to file')
  .option('--db <path>', 'Path to CDX analysis database', 'cdx_analysis.db')
  .parse(process.argv);

const domain = program.args[0];
const options = program.opts();

const selector = new SnapshotSelector(options.db);

try {
  let snapshots;
  let title: string;

  const strategy = options.strategy as SelectionStrategy;

  switch (strategy) {
    case 'all':
      snapshots = selector.selectAllUnique(domain);
      title = `All Unique Snapshots: ${domain}`;
      break;

    case 'significant':
      snapshots = selector.selectSignificantOnly(domain, parseFloat(options.threshold));
      title = `Significant Snapshots (score >= ${options.threshold}): ${domain}`;
      break;

    case 'yearly':
      snapshots = selector.selectOnePerYear(domain);
      title = `One Per Year: ${domain}`;
      break;

    case 'top':
      snapshots = selector.selectTopN(domain, parseInt(options.topN));
      title = `Top ${options.topN} Snapshots: ${domain}`;
      break;

    case 'years':
      if (!options.years) {
        console.error('Error: --years required for "years" strategy');
        process.exit(1);
      }
      const years = options.years.map((y: string) => parseInt(y));
      snapshots = selector.selectByYears(domain, years);
      title = `Snapshots from ${years.join(', ')}: ${domain}`;
      break;

    case 'daterange':
      if (!options.start || !options.end) {
        console.error('Error: --start and --end required for "daterange" strategy');
        process.exit(1);
      }
      snapshots = selector.selectDateRange(domain, options.start, options.end);
      title = `Snapshots ${options.start} to ${options.end}: ${domain}`;
      break;

    default:
      console.error(`Unknown strategy: ${strategy}`);
      process.exit(1);
  }

  // Display results
  selector.printSelection(snapshots, title);

  // Export if requested
  if (options.export) {
    selector.exportSelection(snapshots, options.export);
  }

  selector.close();
} catch (err: any) {
  console.error('Error:', err.message);
  selector.close();
  process.exit(1);
}
