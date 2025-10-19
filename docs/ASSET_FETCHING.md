# Asset Fetching Guide

## Overview

The Wayback Crawler now supports full asset fetching, allowing you to browse archived websites locally with all CSS, JavaScript, images, fonts, and other resources.

## Features

- **Full Asset Support**: CSS, JS, images, fonts, video, audio
- **External Resources**: Fetch from CDNs and external domains
- **Size Limits**: Skip large files (default: 50MB) and log for manual download
- **Parallel Fetching**: Assets load in parallel per page
- **URL Rewriting**: Automatic rewriting for local browsing
- **No-Delay Mode**: Maximum speed crawling

## Usage

### Basic Crawling with Assets

```bash
node dist/cli/crawler.js --snapshots snapshots.txt
```

### No-Delay Mode (Maximum Speed)

```bash
node dist/cli/crawler.js --snapshots snapshots.txt --no-delay
```

### HTML Only (No Assets)

```bash
node dist/cli/crawler.js --snapshots snapshots.txt --no-fetch-assets
```

### Same-Domain Assets Only

```bash
node dist/cli/crawler.js --snapshots snapshots.txt --no-external-assets
```

### Custom Size Limit

```bash
node dist/cli/crawler.js --snapshots snapshots.txt --max-asset-size 100
```

### Custom Concurrency

```bash
node dist/cli/crawler.js --snapshots snapshots.txt --asset-concurrency 20
```

## CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--no-delay` | Disable all delays | false |
| `--page-delay-min <seconds>` | Min inter-page delay | 30 |
| `--page-delay-max <seconds>` | Max inter-page delay | 120 |
| `--no-fetch-assets` | Disable asset fetching | false (assets enabled) |
| `--no-external-assets` | Skip external domains | false (external enabled) |
| `--max-asset-size <mb>` | Max file size in MB | 50 |
| `--asset-concurrency <n>` | Parallel downloads | 10 |

## Output Structure

```
archived_pages/
└── example.com/
    └── 20230615120000/
        ├── index.html (rewritten URLs)
        ├── about.html
        ├── manifest.json
        ├── skipped_assets.json
        └── assets/
            ├── css/
            ├── js/
            ├── images/
            ├── fonts/
            └── external/
                ├── cdn.example.com/
                └── fonts.googleapis.com/
```

## Browsing Locally

### Static Server

Navigate directly:
```
http://localhost:3001/archive/example.com/20230615120000/
```

### React Viewer

1. Open dashboard: `http://localhost:3000`
2. Select domain
3. Click snapshot in timeline
4. View in integrated viewer

## Skipped Assets

Large files (>50MB by default) are logged to `skipped_assets.json`:

```json
{
  "domain": "example.com",
  "timestamp": "20230615120000",
  "skipped": [
    {
      "url": "https://example.com/video.mp4",
      "reason": "size_limit",
      "sizeMB": 125.4,
      "waybackUrl": "https://web.archive.org/web/20230615120000/..."
    }
  ]
}
```

Download manually using the `waybackUrl`.

## Performance Tips

1. **Use --no-delay for testing**: Fast iteration on small sites
2. **Limit external assets**: Use `--no-external-assets` to reduce download time
3. **Adjust concurrency**: Higher values (20-30) for faster downloads on good connections
4. **Size limits**: Lower `--max-asset-size` to skip videos/large files

## Troubleshooting

**Assets not loading?**
- Check browser console for 404s
- Verify files exist in `assets/` directory
- Check `skipped_assets.json` for missing files

**Slow crawling?**
- Use `--no-delay` for maximum speed
- Increase `--asset-concurrency`
- Use `--no-external-assets` to skip CDNs

**Out of disk space?**
- Lower `--max-asset-size`
- Use `--no-external-assets`
- Clean old archives regularly
