# Browser Dashboard

## Overview

The browser-based dashboard provides a visual interface for the Wayback Archive Toolkit. It displays system status, domain information, and provides an interactive command builder for CLI tools.

## Features

### Dashboard View (Home)

**3-Column Responsive Grid:**
- **System Status** - API health, database status, domain count
- **Domain List** - All tracked domains with click navigation
- **Command Builder** - Interactive form to generate CLI commands

### Detail Views

- **Domain Page** - Detailed domain statistics, snapshots, timeline
- **Logs Viewer** - System log file browser

## Architecture

### Frontend Stack
- React 19 with TypeScript
- Material-UI v6 for components
- Vite for dev server and bundling

### Backend
- Express API server (port 3001)
- SQLite database (cdx_analysis.db)
- No changes to existing CLI tools

## Usage

### Development

Start API server:
```bash
npm run api
```

Start frontend dev server:
```bash
npm run dev
```

Open http://localhost:3000

### Production

Build frontend:
```bash
npm run build:frontend
```

Serve static files from `dist/frontend/` with API server.

## Command Builder

The command builder generates CLI commands without executing them. Users copy the generated command and run it in their terminal.

**Supported Tools:**
- CDX Analyzer - Analyze and populate database
- Crawler - Download snapshots with assets
- Selector - Select snapshots by strategy
- Generator - Generate timeline reports

## Components

### Dashboard Components

**SystemStatus** (`src/frontend/components/Dashboard/SystemStatus.tsx`)
- Fetches /api/health and /api/domains
- Auto-refreshes every 30 seconds
- Displays API status, database connection, domain count

**DomainListPanel** (`src/frontend/components/Dashboard/DomainListPanel.tsx`)
- Fetches /api/domains
- Clickable list navigates to DomainPage
- Scrollable for many domains

**CommandBuilder** (`src/frontend/components/Dashboard/CommandBuilder.tsx`)
- Tool selection dropdown
- Dynamic form fields per tool
- Real-time command generation
- Copy to clipboard

### Utilities

**commandBuilder** (`src/utils/commandBuilder.ts`)
- Shared logic from ToolRunner.ts
- Handles negated booleans (--no-fetch-assets)
- Handles positional args (selector domain)
- Converts camelCase to kebab-case flags

## Theme

Dark theme configured in `src/frontend/theme.ts`:
- Blue primary, green secondary colors
- Dark background (#0a0e27)
- Paper background (#1a1f3a)
- Monospace for code elements

## Migration from CLI Menu

The CLI menu (`npm start`) still exists for terminal-only environments. The browser dashboard is the recommended interface when a browser is available.

**CLI Menu Features Not in Browser:**
- Direct tool execution (browser shows commands to copy instead)
- Server lifecycle management (browser assumes server is running)

Both interfaces share the same backend API and database.
