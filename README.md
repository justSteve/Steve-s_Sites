# Multi-Domain Wayback Archive Toolkit

A comprehensive TypeScript/Python hybrid toolkit for archiving multiple domains across decades from the Wayback Machine. Patient, polite, and designed for long-term collection with intelligent snapshot selection.

**Now with Beads integration** for persistent development task tracking across sessions!

## Overview

This project provides tools to analyze, select, and archive historical snapshots of multiple domains from the Internet Archive's Wayback Machine. Rather than blindly downloading everything, it helps you identify significant changes over time and prioritize which snapshots to preserve.

The project uses **Beads** (`bd`) for issue tracking, giving you and your AI assistants persistent memory of development tasks, what's in progress, and what's blocked.

## Architecture

### Hybrid TypeScript/Python Design

This project uses a **hybrid architecture** combining the best of both languages:

**TypeScript** (Primary):
- Core services (CDX analysis, crawler, selector, timeline generator)
- Full MVC pattern with type safety
- CLI tools with Commander
- Database operations via better-sqlite3
- Centralized logging with Winston
- Built for production use

**Python** (Utilities):
- Specialized data processing scripts
- Quick prototyping and analysis
- Beads integration helpers
- Legacy compatibility

**Future**: Vue.js frontend for interactive timeline visualization

## Features

### Analysis Tools
- **CDX API Integration**: Query Wayback Machine's CDX server for complete capture history
- **Change Detection**: Identify content changes using digest hashes
- **Timeline Visualization**: Generate HTML/text/JSON timelines showing evolution over decades
- **Intelligent Selection**: Multiple strategies for choosing which snapshots to download

### Crawler Features
- **Multi-Domain Support**: Configure and track multiple domains simultaneously
- **Multi-Timestamp Support**: Download snapshots from different time periods
- **Optional Off-Peak Scheduling**: Scheduler can be disabled for immediate crawling
- **Configurable Scheduling**: Customize off-peak hours (default: 10 PM - 6 AM)
- **Polite Rate Limiting**: Configurable 30-120 second random delays between requests
- **Persistent State**: SQLite databases track progress, allowing resume after interruption
- **Automatic Link Discovery**: Crawls all internal links found on pages
- **Organized Storage**: Files saved by domain/timestamp/path structure

## Installation

### Prerequisites

- Node.js 20+ and npm
- Python 3.12+ (for utilities)
- Go 1.23+ (for Beads)

### TypeScript Setup

```bash
# Install dependencies
npm install

# Build TypeScript code
npm run build
```

### Python Dependencies (Optional)

```bash
# For Python utilities
pip install -r requirements.txt
```

### Beads (Development Task Tracker)

Beads tracks **development tasks** (features, bugs, refactoring), not archive content.

```bash
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/install.sh | bash
```

Or with Go:

```bash
go install github.com/steveyegge/beads/cmd/bd@latest
```

Check current development work:

```bash
bd ready     # Show what's ready to work on
bd list      # Show all development issues
bd show <id> # Show issue details
```

## Quick Start

### 1. Configure Your Domains

Edit `domains.json`:

```json
{
  "domains": [
    {
      "name": "juststeve.com",
      "activeYears": "1997-present",
      "priority": "high",
      "notes": "Personal site"
    }
  ]
}
```

### 2. Analyze Available Snapshots

```bash
npm run cdx-analyzer
```

This queries the Wayback Machine CDX API and stores results in `cdx_analysis.db`:
- All unique content versions (by digest hash)
- Change scores between versions
- Year-by-year statistics

### 3. Generate Timeline Reports

```bash
npm run generator
```

Creates reports in `reports/`:
- HTML timelines with visual change indicators
- Text-based summaries
- JSON exports for programmatic access

### 4. Select Snapshots to Download

Choose which snapshots to archive:

```bash
# All unique versions
npm run selector -- juststeve.com --strategy all --export snapshots.txt

# Only significant changes (score > 50)
npm run selector -- juststeve.com --strategy significant --threshold 50 --export snapshots.txt

# One representative snapshot per year
npm run selector -- juststeve.com --strategy yearly --export snapshots.txt

# Top 10 most significant changes
npm run selector -- juststeve.com --strategy top --top-n 10 --export snapshots.txt

# Specific years
npm run selector -- juststeve.com --strategy years --years 1999 2005 2010 --export snapshots.txt

# Date range
npm run selector -- juststeve.com --strategy daterange --start 19990101 --end 19991231 --export snapshots.txt
```

### 5. Download Selected Snapshots

Run the crawler:

```bash
# With off-peak scheduler (default: 10 PM - 6 AM)
npm run crawler -- --snapshots snapshots.txt

# Without scheduler (runs immediately)
npm run crawler -- --snapshots snapshots.txt --no-scheduler

# Custom off-peak hours
npm run crawler -- --snapshots snapshots.txt --off-peak-start 23:00 --off-peak-end 07:00

# Custom delays between requests
npm run crawler -- --snapshots snapshots.txt --min-delay 60 --max-delay 300
```

The crawler will:
1. Wait until off-peak hours (if scheduler enabled)
2. Fetch each snapshot with polite delays
3. Save to `archived_pages/domain/timestamp/`
4. Discover and download linked pages
5. Track progress in `crawler_state.db`

**Deduplication & Resume:**

The crawler tracks all processed snapshots in `crawler_state.db` to prevent duplicate crawling:
- Each URL+timestamp combination has a unique primary key
- Status tracking: `pending` → `completed` or `failed`
- Only pending URLs are crawled
- Discovered links are automatically added (if not already tracked)
- **Safe to restart**: The crawler is idempotent - run it multiple times and it will only process new/pending URLs

Check crawl progress:
```bash
sqlite3 crawler_state.db "SELECT status, COUNT(*) FROM urls GROUP BY status"
```

Stop anytime with `Ctrl+C` and resume later - progress is saved automatically.

## CLI Reference

### CDX Analyzer
```bash
npm run cdx-analyzer -- [options]
```

Analyzes snapshot history for all domains in `domains.json`.

### Snapshot Selector
```bash
npm run selector -- <domain> [options]

Options:
  --strategy <strategy>  Selection strategy (default: all)
                        all, significant, yearly, top, years, daterange
  --threshold <number>   Change score threshold for "significant" (default: 50.0)
  --top-n <number>       Number of snapshots for "top" (default: 10)
  --years <years...>     Specific years for "years" strategy
  --start <date>         Start date for "daterange" (YYYYMMDD)
  --end <date>           End date for "daterange" (YYYYMMDD)
  --export <file>        Export selection to file
  --db <path>            Database path (default: cdx_analysis.db)
```

### Timeline Generator
```bash
npm run generator -- [options]

Options:
  --domain <domain>  Generate reports for specific domain only
  --db <path>        Database path (default: cdx_analysis.db)
  --output <dir>     Output directory (default: reports)
  --html             Generate HTML timeline only
  --text             Generate text report only
  --json             Generate JSON export only
```

### Wayback Crawler
```bash
npm run crawler -- [options]

Options:
  --snapshots <file>       Path to snapshot selection file
  --no-scheduler           Disable off-peak scheduler (run continuously)
  --off-peak-start <time>  Off-peak start time HH:MM (default: 22:00)
  --off-peak-end <time>    Off-peak end time HH:MM (default: 06:00)
  --min-delay <seconds>    Min delay between requests (default: 30)
  --max-delay <seconds>    Max delay between requests (default: 120)
  --output <dir>           Output directory (default: archived_pages)
```

## Project Structure

```
justSteve/
├── src/                          # TypeScript source
│   ├── models/                   # Type definitions
│   │   └── types.ts
│   ├── services/                 # Core business logic
│   │   ├── CDXAnalyzerController.ts
│   │   ├── DatabaseService.ts
│   │   ├── LoggingService.ts
│   │   ├── WaybackAPIService.ts
│   │   ├── WaybackCrawler.ts
│   │   ├── SnapshotSelector.ts
│   │   ├── TimelineGenerator.ts
│   │   └── PythonBridge.ts
│   ├── utils/                    # Utilities
│   │   ├── ConfigLoader.ts
│   │   └── DateFormatter.ts
│   └── cli/                      # CLI entry points
│       ├── cdx-analyzer.ts
│       ├── crawler.ts
│       ├── selector.ts
│       └── generator.ts
├── dist/                         # Compiled TypeScript (created by build)
├── python/                       # Python utilities
│   └── beads_integration.py     # Beads API wrapper
├── domains.json                  # Domain configuration
├── cdx_analysis.db              # Analysis results (created)
├── crawler_state.db             # Crawler progress (created)
├── archived_pages/              # Downloaded files (created)
│   └── domain/
│       └── timestamp/
│           └── path/
├── reports/                     # Timeline reports (created)
├── logs/                        # Log files (created)
├── .beads/                      # Beads database
│   └── issues.jsonl            # Git-tracked issue sync
├── package.json                 # Node dependencies & scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

## Development with Beads

### Check Development Tasks

```bash
bd ready              # What development tasks can I work on now?
bd list --status open # What features/bugs are still pending?
bd show wayback-11    # Get details on specific task
```

### Working on a Task

```bash
# Mark task as in progress
bd update wayback-11 --status in_progress

# Complete task
bd close wayback-11 --reason "Completed in commit abc123"
```

### Creating New Development Tasks

```bash
# File a new feature
bd create "Add retry logic to crawler" -p 1 -t feature

# File a bug
bd create "Fix timestamp parsing in selector" -p 0 -t bug

# Add dependencies
bd dep add wayback-20 wayback-11  # wayback-11 blocks wayback-20
```

### For AI Assistants

Beads provides a programmatic interface:

```python
from beads_integration import *

# Get ready development work
ready = get_ready_work(limit=5)
for issue in ready:
    print(f"{issue['id']}: {issue['title']}")

# Create development tasks
new_id = create_issue(
    title="Add unit tests for WaybackCrawler",
    description="Coverage for all public methods",
    priority=1,
    issue_type="task"
)

# Update status as you work
update_issue(new_id, status="in_progress")
```

See `python/beads_integration.py` for the full API.

## TypeScript Migration

The project has been migrated from Python to TypeScript for:
- **Type Safety**: Compile-time error checking
- **Better IDE Support**: IntelliSense and refactoring
- **Modern Async/Await**: Cleaner asynchronous code
- **Performance**: Direct database access without ORM overhead
- **Unified Codebase**: Consistent with future Vue.js frontend

See [TYPESCRIPT_MIGRATION.md](./TYPESCRIPT_MIGRATION.md) for detailed migration notes and comparison with Python versions.

## Available Collapse Options

The CDX API's `collapse` parameter can deduplicate results:

- `collapse=digest` - Only unique content (removes identical captures)
- `collapse=timestamp:6` - One per year (YYYYMM → YYYY**)
- `collapse=timestamp:8` - One per month (YYYYMMDD → YYYYMM**)
- `collapse=timestamp:10` - One per day (YYYYMMDDHH → YYYYMMDD**)
- `collapse=urlkey` - First capture of each unique URL

## Development Scripts

```bash
npm run build         # Compile TypeScript
npm run watch         # Watch mode for development
npm run test          # Run tests
npm run test:coverage # Run tests with coverage
npm run lint          # Lint TypeScript code
npm run format        # Format code with Prettier
```

## Tips

- **Check development tasks**: Use `bd ready` to see what features/bugs are ready to work on
- **Start with analysis**: Run CDX analyzer first to understand what's available
- **Review timelines**: Check HTML timelines in `reports/` before downloading
- **Be selective**: Use selection strategies to focus on meaningful changes
- **Track new features**: When you identify needed functionality, create Beads issues with `bd create`
- **Monitor progress**: Check log files and database for crawling status
- **Long-term project**: Archival is designed to run over days/weeks, be patient
- **Scheduler flexibility**: Use `--no-scheduler` when you need immediate results

## License

MIT

## Contributing

Development tasks are tracked in Beads. Run `bd ready` to see what needs work!
