# Multi-Domain Wayback Archive Toolkit

A comprehensive TypeScript/Python hybrid toolkit for archiving multiple domains across decades from the Wayback Machine. Patient, polite, and designed for long-term collection with intelligent snapshot selection.

**Agent-first design**: Uses Beads for persistent memory of content discoveries, patterns, and archival state across sessions.

## Overview

This project provides tools to analyze, select, and archive historical snapshots of multiple domains from the Internet Archive's Wayback Machine. Rather than blindly downloading everything, it helps you identify significant changes over time and prioritize which snapshots to preserve.

The project uses **Beads** (`bd`) as an agent-first memory system, allowing AI assistants to maintain persistent knowledge about content discoveries, archival patterns, and gaps in coverage across multiple sessions.

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
- Beads API wrapper for agent memory
- Legacy compatibility

**Future**: Vue.js frontend for interactive timeline visualization

### Project Structure

This project follows a **domain-driven architecture** with shared infrastructure packages:

```
/root/
├── packages/              # Shared infrastructure (reusable across projects)
│   ├── api-server/       # @myorg/api-server
│   │   └── Express boilerplate with CORS, health check, error handling
│   └── dashboard-ui/     # @myorg/dashboard-ui
│       └── React/MUI components and dark theme
│
└── projects/justSteve/   # WBM domain project
    └── src/
        ├── domain/       # WBM-specific business logic
        │   ├── cdx/     # CDX analysis
        │   ├── crawler/ # Wayback crawler
        │   ├── assets/  # Asset fetching
        │   └── models/  # Data models
        ├── api/         # WBM API routes (uses @myorg/api-server)
        ├── frontend/    # WBM UI (references @myorg/dashboard-ui)
        ├── cli/         # Command-line tools
        ├── services/    # Infrastructure services
        └── utils/       # Shared utilities
```

**Dependencies:**
- `@myorg/api-server` - Shared API server infrastructure
- `@myorg/dashboard-ui` - Shared UI components (available for use)

This structure allows WBM to maintain domain-specific implementations while sharing infrastructure with future projects.

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

### Beads (Agent Memory System)

Beads provides persistent memory for AI agents working with archival content.

```bash
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/install.sh | bash
```

Or with Go:

```bash
go install github.com/steveyegge/beads/cmd/bd@latest
```

Example usage:

```bash
bd list --labels juststeve.com  # What patterns have been discovered?
bd create "Content gap 2015-2017" -p 2 -t gap
bd show <id>                     # Get details on specific finding
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

**Understanding Crawler Progress:**

The crawler tracks **individual pages**, not snapshots. When you start with one snapshot, the crawler:
- Fetches the snapshot URL
- Discovers all internal links on that page
- Adds each discovered link to the queue
- One snapshot can expand to hundreds of pages

**Status meanings:**
- **Completed**: Individual page has been fetched, saved to disk, and had its links extracted
- **Pending**: Individual page is queued but not yet crawled
- **Failed**: Individual page could not be fetched (404, network error, etc.)

Example output: `Stats: {"pending":47,"completed":3}` means 3 pages have been fully processed and 47 pages are waiting to be crawled.

**Deduplication & Resume:**

The crawler tracks all processed pages in `crawler_state.db` to prevent duplicate crawling:
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

## Asset Fetching

Crawl complete websites with all assets (CSS, JS, images, fonts):

```bash
# Full asset fetching with no delays
node dist/cli/crawler.js --snapshots snapshots.txt --no-delay

# HTML only
node dist/cli/crawler.js --snapshots snapshots.txt --no-fetch-assets
```

See [Asset Fetching Guide](docs/ASSET_FETCHING.md) for details.

## Local Browsing

View archived pages locally:

**Static Server:**
```
http://localhost:3001/archive/example.com/20230615120000/
```

**React Viewer:**
Open dashboard → Select domain → Click snapshot

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

## Agent Memory with Beads

Beads is an **agent-first memory system** that allows AI assistants to maintain persistent knowledge about archival operations across sessions. Unlike traditional issue trackers, Beads focuses on **content discovery and archival state**, not development tasks.

### Archival Memory Use Cases

**Content Discovery Tracking:**
```bash
# Record significant content patterns found
bd create "juststeve.com 2003-2005: Photography portfolio emerged" \
  -p 1 -t observation \
  --context "Digest changes show image-heavy content, check for external image hosts"

# Track incomplete snapshots that need retry
bd create "juststeve.com/blog/2010: 15 broken image links" \
  -p 0 -t incomplete \
  --context "404s on img subdomain, may need separate CDX query"
```

**Cross-Snapshot Patterns:**
```bash
# Note content migrations
bd create "Domain migration detected: 2008-06 → 2008-09" \
  -p 1 -t migration \
  --context "URL structure changed from /content/ to /posts/, rewrite rules needed"

# Track missing periods
bd create "Gap in snapshots: 2015-2017" \
  -p 2 -t gap \
  --context "Only 3 snapshots across 2 years, high priority for manual archive.org search"
```

**Agent-to-Agent Knowledge Transfer:**
```python
from beads_integration import *

# Query archival state for a domain
issues = list_issues(labels=["juststeve.com", "observation"])
for obs in issues:
    print(f"Previous finding: {obs['title']}")
    print(f"Context: {obs.get('context', 'N/A')}\n")

# Record new findings for future sessions
create_issue(
    title="SSL cert change correlates with content redesign",
    description="2012-03 snapshots show HTTPS switch + new CSS framework",
    priority=1,
    issue_type="pattern",
    labels=["juststeve.com", "2012"]
)
```

### Why Agent-First?

Traditional tools track **what humans need to do**. Beads tracks **what agents have learned**:
- Content patterns across time
- Failed fetches that need investigation
- Domain migrations and URL rewrites
- Gaps in coverage
- Relationships between snapshots

This persistent memory allows agents to:
1. Resume complex archival operations across sessions
2. Share discoveries between multiple agents working in parallel
3. Build cumulative knowledge about domain history
4. Prioritize which snapshots to fetch based on past findings

See `python/beads_integration.py` for the programmatic API.

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

- **Review past discoveries**: Use `bd list` to see what content patterns have been found previously
- **Start with analysis**: Run CDX analyzer first to understand what's available
- **Review timelines**: Check HTML timelines in `reports/` before downloading
- **Be selective**: Use selection strategies to focus on meaningful changes
- **Record findings**: When you discover content patterns, gaps, or migrations, record them with `bd create`
- **Monitor progress**: Check log files and database for crawling status
- **Long-term project**: Archival is designed to run over days/weeks, be patient
- **Scheduler flexibility**: Use `--no-scheduler` when you need immediate results
- **Agent memory**: Beads persists knowledge across sessions - agents can learn from past archival work

## License

MIT
