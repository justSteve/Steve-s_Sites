# Skills Inventory Correlation Engine — Design Spec

**Date:** 2026-03-29
**Status:** Draft
**Scope:** Phase 1 — Structured inventory and correlation database

## Purpose

Build a system that scans three source types (backed-up codebases, email archives, Wayback snapshots), extracts evidence of professional skills and business activity, correlates them by time and project, and produces a queryable database. This database becomes the foundation for generating audience-specific professional narratives (Phase 2, future work).

## Context

Steve operated a suite of successful web businesses from the late 1990s through 2018+, primarily in financial institution training (Total Training Solutions, BankWebinars, CUWebinars). The evidence is scattered across:

- **DataArchive catalog** — 2.47M files across 21 physical drives, indexed in SQLite (read-only at `/root/projects/DataArchive/data/archive.db`)
- **Gmail Takeouts** — 4 accounts, ~11 GB mbox data (read-only on Z: drive at `/mnt/z/Backups/GMailTakeouts/processed/`)
  - `steve@ttstrain.com` (3.8 GB) — primary business email
  - `florencio1993@ttstrain.com` (4.2 GB) — TTS staff account
  - `registrations@bankwebinars.com` (2.9 GB) — webinar registration system
  - `cftacs@bankwebinars.com` (377 MB) — BankWebinars operations + Calendar, Contacts, Drive, Hangouts, Tasks
- **Wayback archive snapshots** — 5 domains in `archived_pages/` (juststeve.com, ttstrain.com, w3.ttstrain.com, bankwebinars.com, cuwebinars.com)
- **Bonus artifacts** — Calendar (.ics), Contacts (.vcf), Google Drive files, Hangouts conversations, YouTube subscriptions from the cftacs account

## Constraints

- **All source operations are read-only.** No modifications, no deletions. Classification is tagging in the output database, never mutation of source data.
- **Full access granted.** No PII filtering on intake. Sensitivity filtering applies only to output/publication (Phase 2).
- **Full arc coverage.** ~1997 through 2018+, from personal web presence through SaaS business operations.
- **Development correspondence is primary interest.** Transactional/invoice email is counted for scale metrics but not individually indexed. The correlation between "someone asked for a feature" and "the code changed" is the core value.

## Architecture

### Overview

Three read-only source adapters feed a unified correlation database. Each adapter normalizes its findings into a common artifact format with timestamps, project tags, and technology markers.

```
DataArchive SQLite ──> [Code Adapter] ──┐
                                        │
Mbox files on Z: ────> [Email Adapter] ─┼──> Correlation DB (new SQLite)
                                        │
archived_pages/ ─────> [Archive Adapter]┘
```

### Source Adapters

#### 1. Code Adapter

Queries the DataArchive SQLite database (read-only) for file metadata.

**Project detection:** Scans for project root markers — `.sln`, `.csproj`, `web.config`, `package.json`, `Global.asax`, `manage.py` — and groups files by containing directory. Each detected project gets:
- A canonical name (derived from directory name)
- A technology fingerprint (from file extensions, config files, project file contents where available)
- A date range (from file modification timestamps)
- File count and size metrics

**Technology extraction:** Maps file extensions and path conventions to technologies:
- `.cs` + `.csproj` = C# / .NET (version from csproj TargetFramework)
- `.cshtml` = Razor / ASP.NET MVC
- `.aspx` = ASP.NET WebForms
- `packages.config` = NuGet dependencies (parseable for specific libraries)
- `web.config` = ASP.NET configuration (IIS, connection strings patterns)
- `.sln` = Visual Studio version indicator
- `*.WebJobs.*` paths = Azure WebJobs
- `docker-compose.yml` = Docker
- `.py` = Python

**Drive-era mapping:** Uses DataArchive's drive metadata to place projects in hardware eras (UIER=2003-2014, OCL=2014-2018, LBWZ=production server, etc.).

#### 2. Email Adapter

Parses mbox files using Python's `mailbox` module. All four accounts processed.

**Per-message extraction:**
- Timestamp (Date header, normalized to UTC)
- Sender and recipients (From, To, CC)
- Subject line
- Message-ID and In-Reply-To / References (for thread reconstruction)
- Body text (plain text preferred, HTML fallback with tag stripping)

**Three-tier classification (tagging, not filtering):**

- **Tier 1 — Transactional (~70%):** Registration confirmations, invoice copies, automated notifications, marketing blasts. Identified by: sender patterns (noreply@, automated subjects like "Registration Confirmed", "Invoice #"), template structure. Tagged and counted for volume metrics in a separate `email_volume` table (monthly counts by account, not per-message rows in artifacts).

- **Tier 2 — Development (~20%):** Messages containing project names (matched against Code Adapter's project map), technical terms (deploy, bug, feature, release, server, database, migration, build, test, API, endpoint, error, fix, update, merge, branch, commit, production, staging), tool/vendor discussions. Full indexing with thread reconstruction.

- **Tier 3 — Strategic (~10%):** Business decisions, partnerships, hiring, architecture discussions, client escalations that drove product changes. Identified from Tier 2 scanning + thread importance scoring (reply depth, participant count, subject keywords like "decision", "proposal", "redesign", "new product", "contract").

**Thread reconstruction:** Group messages by References/In-Reply-To chains. A thread inherits the highest tier of any member message.

#### 3. Archive Adapter

Reads `archived_pages/` filesystem structure.

**Per-snapshot extraction:**
- Domain and timestamp (from directory names)
- Technology markers from HTML content (ASP links, WordPress signatures, SpinDB URLs, jQuery/Bootstrap versions, meta generator tags)
- Navigation structure (what sections/products the site advertised)
- Design era classification (table-based, CSS, responsive, etc.)
- Content completeness assessment (static capture vs. database-driven gap)

**Cross-reference:** Matches archive technology markers against Code Adapter's project timelines to validate "the site was running on X framework, and we have the source code for that framework version."

### Data Model

#### artifacts table
```sql
CREATE TABLE artifacts (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,          -- 'code', 'email', 'archive'
  timestamp TEXT NOT NULL,       -- ISO 8601 UTC
  project TEXT,                  -- canonical project name
  category TEXT NOT NULL,        -- 'development', 'operations', 'business', 'transactional'
  tier INTEGER,                  -- email tier (1/2/3), NULL for non-email
  summary TEXT,                  -- short description
  evidence_path TEXT,            -- pointer to source (file path, mbox path + offset, snapshot dir)
  raw_metadata TEXT              -- JSON blob of source-specific details
);
```

#### technologies table
```sql
CREATE TABLE technologies (
  id INTEGER PRIMARY KEY,
  artifact_id INTEGER REFERENCES artifacts(id),
  name TEXT NOT NULL,            -- e.g., "C#", "ASP.NET MVC5", "jQuery 1.7.2"
  category TEXT                  -- "language", "framework", "database", "tool", "service"
);
```

#### people table
```sql
CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  artifact_id INTEGER REFERENCES artifacts(id),
  email TEXT,
  name TEXT,
  role TEXT                      -- "sender", "recipient", "cc"
);
```

#### projects table
```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,     -- canonical name
  first_seen TEXT,               -- earliest artifact timestamp
  last_seen TEXT,                -- latest artifact timestamp
  file_count INTEGER,
  technology_summary TEXT,       -- JSON array of primary technologies
  description TEXT               -- derived from code structure + email context
);
```

#### correlations table
```sql
CREATE TABLE correlations (
  id INTEGER PRIMARY KEY,
  artifact_a INTEGER REFERENCES artifacts(id),
  artifact_b INTEGER REFERENCES artifacts(id),
  correlation_type TEXT,         -- 'temporal', 'project', 'technology', 'person'
  strength REAL,                 -- 0.0-1.0 score
  window_days INTEGER,           -- time gap between artifacts
  notes TEXT
);
```

#### email_volume table
```sql
CREATE TABLE email_volume (
  id INTEGER PRIMARY KEY,
  account TEXT NOT NULL,         -- e.g., "steve@ttstrain.com"
  year_month TEXT NOT NULL,      -- "2015-03"
  total_count INTEGER,
  tier1_count INTEGER,           -- transactional
  tier2_count INTEGER,           -- development
  tier3_count INTEGER            -- strategic
);
```

#### email_threads table
```sql
CREATE TABLE email_threads (
  id INTEGER PRIMARY KEY,
  subject TEXT,
  message_count INTEGER,
  participant_count INTEGER,
  first_message TEXT,            -- timestamp
  last_message TEXT,             -- timestamp
  max_tier INTEGER,              -- highest tier in thread
  project TEXT                   -- associated project if detected
);
```

#### email_thread_members table
```sql
CREATE TABLE email_thread_members (
  thread_id INTEGER REFERENCES email_threads(id),
  artifact_id INTEGER REFERENCES artifacts(id),
  sequence INTEGER               -- position in thread
);
```

### Built-In Views / Queries

- **Timeline view** — chronological artifact stream, filterable by project/category/technology/date range
- **Project profile** — per-project summary: tech stack, date range, file count, email thread count, Wayback snapshots, key people
- **Skills matrix** — technologies x time periods with artifact counts as evidence weight
- **Correlation hits** — multi-source correlations: email thread about feature X + code changes in project Y within N days + site snapshot showing feature live. These three-source hits are the highest-value output.
- **Volume metrics** — transactional email counts over time as proxy for business scale

## Implementation

**Language:** Python, located in this repo under a new directory (e.g., `python/inventory/`).

**Dependencies:**
- `sqlite3` (stdlib) — read DataArchive DB, write correlation DB
- `mailbox` (stdlib) — parse mbox files
- `email` (stdlib) — parse individual messages
- Standard library preferred; minimal external dependencies

**Processing order:**
1. Code Adapter — establishes the project map and technology timeline
2. Archive Adapter — adds public-facing evidence, validates technology eras
3. Email Adapter — classifies against the project map from step 1 (longest step)

**Output location:** New SQLite database at `data/skills_inventory.db`

**CLI tool:** Simple query interface for exploring the database interactively. Commands like:
- `inventory timeline --project BankWebinars --start 2014 --end 2016`
- `inventory project BankWebinars5`
- `inventory skills --year 2015`
- `inventory correlations --project TTSCore --min-strength 0.5`

## What This Spec Does NOT Cover

- **Phase 2 narrative generation** — audience-specific portfolio documents, resume content, case studies. Future work that consumes this database.
- **UI/dashboard** — a web interface for browsing the inventory. Possible future work.
- **Email content publication** — any output containing message bodies or PII. Sensitivity filtering is a Phase 2 concern.
- **Additional source integration** — Hangouts conversations, Google Drive files, Calendar data, YouTube history from cftacs account. These are available and could be added as future adapters.
