# Multi-Domain Wayback Archive Project

A comprehensive toolkit for archiving multiple domains across decades from the Wayback Machine. Patient, polite, and designed for long-term collection with intelligent snapshot selection.

**Now with Beads integration** for persistent task tracking across sessions!

## Overview

This project provides tools to analyze, select, and archive historical snapshots of multiple domains from the Internet Archive's Wayback Machine. Rather than blindly downloading everything, it helps you identify significant changes over time and prioritize which snapshots to preserve.

The project uses **Beads** (`bd`) for issue tracking, giving you and your AI assistants persistent memory of what work needs to be done, what's in progress, and what's blocked.

## Features

### Analysis Tools
- **CDX API Integration**: Query Wayback Machine's CDX server for complete capture history
- **Change Detection**: Identify content changes using digest hashes
- **Timeline Visualization**: Generate HTML/text/JSON timelines showing evolution over decades
- **Intelligent Selection**: Multiple strategies for choosing which snapshots to download

### Crawler Features
- **Multi-Domain Support**: Configure and track multiple domains simultaneously
- **Multi-Timestamp Support**: Download snapshots from different time periods
- **Off-Peak Scheduling**: Only runs during configured off-peak hours (default: 10 PM - 6 AM)
- **Polite Rate Limiting**: 30-120 second random delays between requests
- **Persistent State**: SQLite databases track progress, allowing resume after interruption
- **Automatic Link Discovery**: Crawls all internal links found on pages
- **Organized Storage**: Files saved by domain/timestamp/path structure

## Installation

### Python Dependencies

```bash
pip install -r requirements.txt
```

### Beads (Issue Tracker)

Beads is used to track work across sessions. Install with:

```bash
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/install.sh | bash
```

Or if you have Go 1.23+:

```bash
go install github.com/steveyegge/beads/cmd/bd@latest
```

Beads is already initialized in this project. To see current work:

```bash
bd ready     # Show what's ready to work on
bd list      # Show all issues
bd show <id> # Show issue details
```

## Workflow

### 0. Check What's Ready (New!)

At any time, check what work is ready using Beads:

```bash
bd ready
```

This shows you unblocked tasks you can work on next. Perfect for resuming after a break!

### 1. Configure Your Domains

Edit `domains.json` to add your domains:

```json
{
  "domains": [
    {
      "name": "juststeve.com",
      "active_years": "1997-present",
      "priority": "high",
      "notes": "Personal site"
    },
    {
      "name": "ttstrain.com",
      "active_years": "1997-2019",
      "priority": "high",
      "notes": "Commercial site, no longer active"
    }
  ]
}
```

### 2. Analyze Available Snapshots

Run the CDX analyzer to discover all snapshots and identify changes:

```bash
python cdx_analyzer.py
```

This queries the Wayback Machine CDX API and stores:
- All unique content versions (by digest hash)
- Change scores between versions
- Year-by-year statistics
- Results saved to `cdx_analysis.db`

### 3. Generate Timeline Reports

Visualize the history of changes:

```bash
python generate_timeline.py
```

Creates reports in `reports/`:
- HTML timelines with visual change indicators
- Text-based summaries
- JSON exports for programmatic access

### 4. Select Snapshots to Download

Choose which snapshots to archive using various strategies:

```bash
# Get all unique versions
python select_snapshots.py juststeve.com --strategy all --export snapshots_to_download.txt

# Only significant changes (score > 50)
python select_snapshots.py juststeve.com --strategy significant --threshold 50 --export snapshots_to_download.txt

# One representative snapshot per year
python select_snapshots.py juststeve.com --strategy yearly --export snapshots_to_download.txt

# Top 10 most significant changes
python select_snapshots.py juststeve.com --strategy top --top-n 10 --export snapshots_to_download.txt

# Specific years
python select_snapshots.py juststeve.com --strategy years --years 1999 2005 2010 --export snapshots_to_download.txt

# Date range
python select_snapshots.py juststeve.com --strategy daterange --start 19990101 --end 19991231 --export snapshots_to_download.txt
```

### 5. Download Selected Snapshots

Run the crawler with your selection file:

```bash
python wayback_crawler.py --snapshots snapshots_to_download.txt
```

The crawler will:
1. Wait until off-peak hours
2. Fetch each snapshot with polite delays
3. Save to `archived_pages/domain/timestamp/`
4. Discover and download linked pages
5. Track progress in `crawler_state.db`

Stop anytime with `Ctrl+C` and resume later by running the same command.

## Available Collapse Options

The CDX API's `collapse` parameter can deduplicate results:

- `collapse=digest` - Only unique content (removes identical captures)
- `collapse=timestamp:6` - One per year (YYYYMM → YYYY**)
- `collapse=timestamp:8` - One per month (YYYYMMDD → YYYYMM**)
- `collapse=timestamp:10` - One per day (YYYYMMDDHH → YYYYMMDD**)
- `collapse=urlkey` - First capture of each unique URL

## Project Structure

```
justSteve/
├── domains.json                # Domain configuration
├── cdx_analyzer.py            # Analyze snapshot history
├── generate_timeline.py       # Create visualizations
├── select_snapshots.py        # Choose snapshots to download
├── wayback_crawler.py         # Download selected snapshots
├── requirements.txt           # Python dependencies
├── cdx_analysis.db           # CDX analysis results (created)
├── crawler_state.db          # Crawler progress (created)
├── archived_pages/           # Downloaded files (created)
│   └── domain/
│       └── timestamp/
│           └── path/
├── reports/                  # Timeline reports (created)
└── logs/                     # Various log files (created)
```

## Configuration

Edit constants at the top of scripts to customize:

**wayback_crawler.py**:
```python
OFF_PEAK_START = dt_time(22, 0)  # 10 PM
OFF_PEAK_END = dt_time(6, 0)     # 6 AM
MIN_DELAY_SECONDS = 30
MAX_DELAY_SECONDS = 120
```

**cdx_analyzer.py**:
```python
REQUEST_DELAY = 2  # Seconds between CDX API requests
```

## Tips

- **Check ready work**: Use `bd ready` to see what's unblocked and ready to work on
- **Start with analysis**: Run CDX analyzer first to understand what's available
- **Review timelines**: Check HTML timelines in `reports/` before downloading
- **Be selective**: Use selection strategies to focus on meaningful changes
- **Track discoveries**: When you find new domains or pages worth archiving, create issues with `bd create`
- **Monitor progress**: Check log files and `bd list` to see what's happening
- **Long-term project**: This is designed to run over days/weeks, be patient

## Working with Beads

### For Humans

Check progress at any time:

```bash
bd ready              # What can I work on now?
bd list --status open # What's still pending?
bd dep tree wayback-5 # Show dependencies for an issue
bd show wayback-2     # Get details on specific issue
```

### For AI Assistants

Beads provides a programmatic interface via `--json` flags:

```python
from beads_integration import *

# Get ready work
ready = get_ready_work(limit=5)
for issue in ready:
    print(f"{issue['id']}: {issue['title']}")

# Create issues for discovered work
new_id = create_issue(
    title="Archive example.com",
    description="Found reference in juststeve.com",
    priority=1,
    issue_type="task"
)

# Link discovered work
add_dependency(new_id, "wayback-5", dep_type="discovered-from")

# Update status
update_issue(new_id, status="in_progress")
```

See `beads_integration.py` for the full API.

### Current Issues

The project is initialized with:
- **wayback-1**: Epic for archiving juststeve.com across decades
- **wayback-2**: Task to analyze CDX history (ready to work on!)
- **wayback-3**: Task to generate timelines (blocked by wayback-2)
- **wayback-4**: Task to select snapshots (blocked by wayback-3)
- **wayback-5**: Task to download Feb 1999 snapshot (blocked by wayback-4)

Run `bd ready` to see what's currently unblocked.

## Timeline

This project is designed for patient, long-term archival. The analysis phase is quick (minutes), but downloading can take days or weeks depending on:
- Number of snapshots selected
- Number of pages per snapshot
- Off-peak hour windows
- Rate limiting delays
