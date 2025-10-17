# TypeScript Migration - Crawler, Selector & Generator

This document describes the TypeScript versions of the crawler, selector, and generator tools.

## Overview

The following Python modules have been successfully migrated to TypeScript:

1. **wayback_crawler.py** → **WaybackCrawler.ts** (service) + **crawler.ts** (CLI)
2. **select_snapshots.py** → **SnapshotSelector.ts** (service) + **selector.ts** (CLI)
3. **generate_timeline.py** → **TimelineGenerator.ts** (service) + **generator.ts** (CLI)

## Key Improvements

### 1. Wayback Crawler

**New Features:**
- **Optional Off-Peak Scheduler**: The crawler now supports a `--no-scheduler` flag to run continuously without waiting for off-peak hours
- Configurable off-peak time windows
- Configurable delay ranges between requests
- Full TypeScript type safety
- Integration with centralized logging service

**Usage:**

```bash
# Run with off-peak scheduler (default: 10 PM - 6 AM)
npm run crawler -- --snapshots snapshots.txt

# Run without scheduler (continuous operation)
npm run crawler -- --snapshots snapshots.txt --no-scheduler

# Custom off-peak hours
npm run crawler -- --snapshots snapshots.txt --off-peak-start 23:00 --off-peak-end 07:00

# Custom delay between requests
npm run crawler -- --snapshots snapshots.txt --min-delay 60 --max-delay 300
```

**Options:**
- `--snapshots <file>`: Path to snapshot selection file
- `--no-scheduler`: Disable off-peak hours scheduler (run continuously)
- `--off-peak-start <time>`: Off-peak start time in HH:MM format (default: 22:00)
- `--off-peak-end <time>`: Off-peak end time in HH:MM format (default: 06:00)
- `--min-delay <seconds>`: Minimum delay between requests (default: 30)
- `--max-delay <seconds>`: Maximum delay between requests (default: 120)
- `--output <dir>`: Output directory for archived pages (default: archived_pages)

### 2. Snapshot Selector

**Features:**
- Multiple selection strategies (all, significant, yearly, top, years, daterange)
- Export selections to file for crawler consumption
- Full TypeScript type safety

**Usage:**

```bash
# Select all unique snapshots
npm run selector -- juststeve.com

# Select significant changes only (score >= 50)
npm run selector -- juststeve.com --strategy significant --threshold 50

# Select one snapshot per year
npm run selector -- juststeve.com --strategy yearly

# Select top 10 most significant changes
npm run selector -- juststeve.com --strategy top --top-n 10

# Select snapshots from specific years
npm run selector -- juststeve.com --strategy years --years 2008 2010 2015

# Select snapshots in a date range
npm run selector -- juststeve.com --strategy daterange --start 20080101 --end 20101231

# Export selection to file
npm run selector -- juststeve.com --strategy significant --export snapshots.txt
```

**Options:**
- `<domain>`: Domain to select snapshots from (required)
- `--strategy <strategy>`: Selection strategy (default: all)
  - `all`: All unique content versions
  - `significant`: Snapshots with significant changes
  - `yearly`: One representative snapshot per year
  - `top`: Top N most significant snapshots
  - `years`: Snapshots from specific years
  - `daterange`: Snapshots within a date range
- `--threshold <number>`: Change score threshold for "significant" strategy (default: 50.0)
- `--top-n <number>`: Number of snapshots for "top" strategy (default: 10)
- `--years <years...>`: Specific years for "years" strategy (space-separated)
- `--start <date>`: Start date for "daterange" strategy (YYYYMMDD format)
- `--end <date>`: End date for "daterange" strategy (YYYYMMDD format)
- `--export <file>`: Export selection to file
- `--db <path>`: Path to CDX analysis database (default: cdx_analysis.db)

### 3. Timeline Generator

**Features:**
- Generate HTML, text, and JSON timeline reports
- Visual representation of content changes over time
- Full TypeScript type safety

**Usage:**

```bash
# Generate all report formats for all domains
npm run generator

# Generate reports for a specific domain
npm run generator -- --domain juststeve.com

# Generate only HTML timeline
npm run generator -- --domain juststeve.com --html

# Generate only text report
npm run generator -- --domain juststeve.com --text

# Generate only JSON export
npm run generator -- --domain juststeve.com --json

# Custom output directory
npm run generator -- --output my-reports
```

**Options:**
- `--domain <domain>`: Generate reports for specific domain only
- `--db <path>`: Path to CDX analysis database (default: cdx_analysis.db)
- `--output <dir>`: Output directory for reports (default: reports)
- `--html`: Generate HTML timeline only
- `--text`: Generate text report only
- `--json`: Generate JSON export only

## Architecture

### Service Layer

All three tools follow a service-oriented architecture:

- **src/services/WaybackCrawler.ts**: Core crawler logic with database management
- **src/services/SnapshotSelector.ts**: Snapshot selection strategies
- **src/services/TimelineGenerator.ts**: Timeline report generation

### CLI Layer

Each service has a corresponding CLI entry point:

- **src/cli/crawler.ts**: Wayback crawler command-line interface
- **src/cli/selector.ts**: Snapshot selector command-line interface
- **src/cli/generator.ts**: Timeline generator command-line interface

### Database Layer

Both the crawler and selector use better-sqlite3 directly for optimal performance and type safety. The services are designed to work with the existing CDX analysis database schema.

## Example Workflow

1. **Analyze CDX data** (creates cdx_analysis.db):
   ```bash
   npm run cdx-analyzer
   ```

2. **Select snapshots to download**:
   ```bash
   npm run selector -- juststeve.com --strategy significant --export snapshots.txt
   ```

3. **Crawl selected snapshots** (with scheduler disabled for immediate execution):
   ```bash
   npm run crawler -- --snapshots snapshots.txt --no-scheduler
   ```

4. **Generate timeline reports**:
   ```bash
   npm run generator
   ```

## Migration Notes

### Breaking Changes

None - the Python scripts remain available and functional.

### Advantages of TypeScript Version

1. **Type Safety**: Full compile-time type checking prevents runtime errors
2. **Better IDE Support**: IntelliSense, auto-completion, and refactoring support
3. **Unified Codebase**: Consistent with the rest of the TypeScript project
4. **Modern Async/Await**: Cleaner asynchronous code compared to Python
5. **Better Error Handling**: Comprehensive error handling with logging service
6. **Performance**: Direct database access without ORM overhead
7. **Flexibility**: Optional off-peak scheduler for crawler

### Compatibility

The TypeScript versions are fully compatible with:
- Existing CDX analysis database (cdx_analysis.db)
- Existing snapshot selection file format (timestamp|url)
- Existing output formats (HTML, text, JSON)

## Testing

All TypeScript modules have been successfully compiled and tested:

```bash
# Build TypeScript code
npm run build

# Test CLI help commands
npm run crawler -- --help
npm run selector -- --help
npm run generator -- --help
```

## Dependencies

New dependencies added:
- **axios**: HTTP client for Wayback Machine API
- **cheerio**: HTML parsing for link extraction
- **better-sqlite3**: SQLite database access
- **commander**: CLI framework
- **winston**: Logging service

All dependencies are already included in package.json.
