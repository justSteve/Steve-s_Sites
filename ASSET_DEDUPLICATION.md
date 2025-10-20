# Asset Deduplication System

## Overview

The Wayback Archive Toolkit implements a **hybrid asset deduplication** system to avoid unnecessary downloads from the Wayback Machine and reduce disk space usage.

## Problem

When archiving websites across multiple timestamps:
- **Graphical elements** (logos, menu icons, chrome elements) are often identical across snapshots
- **Downloading duplicate assets** wastes bandwidth and hits rate limits
- **Storing duplicates** wastes disk space

Example: A logo file `https://example.com/logo.png` appears in 100 snapshots:
- ❌ **Without deduplication**: 100 downloads, 100 files on disk
- ✅ **With deduplication**: 1 download, 1 file on disk (100 hardlinks)

## Solution: Hybrid Deduplication

The system uses a **three-step** hybrid approach:

### Step 1: URL-Based Cache Check (Avoid Downloads)

**Before downloading**, check if the exact Wayback URL has been fetched before:

```typescript
const waybackUrl = `https://web.archive.org/web/20231201120000/https://example.com/logo.png`;
const cachedAsset = db.getAssetByWaybackUrl(waybackUrl);

if (cachedAsset) {
  // ✅ Cache hit! Create hardlink to existing file
  fs.linkSync(cachedAsset.file_path, newPath);
  db.incrementAssetDownloadCount(waybackUrl);
  return { cacheHit: true };
}
```

**Benefits:**
- ✅ Avoids HTTP request entirely
- ✅ Instant (database lookup only)
- ✅ Saves bandwidth and avoids rate limits

### Step 2: Download Asset

If not cached, download normally:

```typescript
const response = await axios.get(waybackUrl, { responseType: 'stream' });
const assetPath = getAssetPath(asset, domain, timestamp);
await saveToFile(response.data, assetPath);
```

### Step 3: Content-Hash Deduplication (Save Disk Space)

**After downloading**, compute SHA-256 hash and check for content duplicates:

```typescript
const contentHash = await computeFileHash(assetPath); // SHA-256
const existingAsset = db.getAssetByContentHash(contentHash);

if (existingAsset && existingAsset.file_path !== assetPath) {
  // ✅ Content duplicate! Replace with hardlink
  fs.unlinkSync(assetPath);                    // Delete duplicate
  fs.linkSync(existingAsset.file_path, assetPath); // Link to original

  return { contentDuplicate: true };
}

// Save to database for future lookups
db.saveAsset({
  waybackUrl,
  originalUrl: asset.url,
  contentHash,
  filePath: assetPath,
  sizeBytes: contentLength,
  //...
});
```

**Benefits:**
- ✅ Detects truly identical content (even from different URLs/timestamps)
- ✅ Saves disk space via hardlinks
- ✅ Tracks duplicate content across entire archive

## Database Schema

```sql
CREATE TABLE assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wayback_url TEXT UNIQUE NOT NULL,          -- Full Wayback URL
  original_url TEXT NOT NULL,                -- Original asset URL
  content_hash TEXT NOT NULL,                -- SHA-256 of content
  file_path TEXT NOT NULL,                   -- Where stored on disk
  size_bytes INTEGER NOT NULL,
  mime_type TEXT,
  first_downloaded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  download_count INTEGER DEFAULT 1,          -- How many times reused
  domain TEXT,
  timestamp TEXT
);

CREATE INDEX idx_assets_wayback_url ON assets(wayback_url);
CREATE INDEX idx_assets_content_hash ON assets(content_hash);
CREATE INDEX idx_assets_original_url ON assets(original_url);
```

## Usage

### Initialization

The assets table is created when initializing the database:

```typescript
const db = new DatabaseService('./cdx_analysis.db', logger);
db.initAssetsSchema(); // Creates assets table
```

### Fetching Assets with Deduplication

Pass the DatabaseService to AssetFetcher:

```typescript
const fetcher = new AssetFetcher(
  {
    outputDir: './archived_pages',
    maxAssetSizeMB: 50,
    concurrency: 3,
  },
  logger,
  db // ← Optional: enables deduplication
);

const result = await fetcher.fetchAssets(assets, domain, timestamp);

console.log(`Cache hits: ${result.deduplication.cacheHits}`);
console.log(`Content duplicates: ${result.deduplication.contentDuplicates}`);
console.log(`Bandwidth saved: ${result.deduplication.bandwidthSavedMB.toFixed(2)}MB`);
```

### Viewing Statistics

```typescript
const stats = db.getAssetStats();

console.log(`Total unique assets: ${stats.totalAssets}`);
console.log(`Total downloads avoided: ${stats.duplicatesAvoided}`);
console.log(`Disk space saved: ${(stats.diskSpaceSavedBytes / 1024 / 1024).toFixed(2)}MB`);
```

## Deduplication Results

After fetching assets, you get detailed statistics:

```typescript
interface FetchResult {
  fetched: AssetReference[];           // Newly downloaded
  skipped: SkippedAsset[];            // Skipped (size limit, 404, etc.)
  errors: Array<...>;
  deduplication: {
    cacheHits: number;                // URL cache hits (downloads avoided)
    contentDuplicates: number;        // Content duplicates found
    bandwidthSavedMB: number;         // Total bandwidth saved
  };
}
```

## Hardlinks Explained

The system uses **hardlinks** (not symlinks or copies):

```bash
# Same logo in 3 snapshots:
/archived_pages/example.com/20230101120000/assets/logo.png  # Original file
/archived_pages/example.com/20230601120000/assets/logo.png  # Hardlink
/archived_pages/example.com/20231201120000/assets/logo.png  # Hardlink
```

**Benefits:**
- All 3 paths point to the same inode (same physical data)
- Deleting one doesn't affect others
- No extra disk space used
- Works transparently (applications see normal files)

**Requirement:** Must be on same filesystem (usually fine within `/root`)

## Performance Impact

### Bandwidth Savings

Example archiving 10 snapshots of a site with common assets:
- **Logo.png**: 500KB × 10 snapshots = 5MB → **500KB** (9× reduction)
- **Menu icons**: 2MB × 10 snapshots = 20MB → **2MB** (10× reduction)
- **CSS files**: Often unchanged across snapshots

**Typical savings: 40-70% bandwidth reduction**

### Disk Space Savings

Content-hash deduplication saves disk space:
- **Same logo different URLs**: Deduplicated
- **Versioned assets** (logo-v1.png, logo-v2.png, logo-v3.png): Only unique versions stored

**Typical savings: 30-60% disk space reduction**

### Computation Overhead

- **URL lookup**: ~0.1ms (indexed database query)
- **SHA-256 hashing**: ~20-50ms for typical image (one-time cost)
- **Hardlink creation**: ~0.1ms

**Net result:** Much faster than HTTP download

## Backwards Compatibility

The deduplication system is **optional**:

```typescript
// Without deduplication (old behavior)
const fetcher = new AssetFetcher(options, logger);

// With deduplication (new behavior)
const fetcher = new AssetFetcher(options, logger, db);
```

Existing code continues to work without changes.

## Logging

The system logs deduplication events:

```
[INFO] Cache hit: https://example.com/logo.png (saved 0.50MB download)
[INFO] Content duplicate: https://example.com/nav.png links to existing https://example.com/navigation.png
[INFO] Fetched image: https://example.com/photo.jpg (1.25MB)
```

## Database API

### DatabaseService Methods

```typescript
// Initialize schema
db.initAssetsSchema(): void

// Check if URL already downloaded
db.getAssetByWaybackUrl(waybackUrl: string): Asset | null

// Check if content hash exists
db.getAssetByContentHash(contentHash: string): Asset | null

// Save new asset record
db.saveAsset(asset: {
  waybackUrl: string;
  originalUrl: string;
  contentHash: string;
  filePath: string;
  sizeBytes: number;
  mimeType?: string;
  domain?: string;
  timestamp?: string;
}): void

// Increment reuse counter
db.incrementAssetDownloadCount(waybackUrl: string): void

// Get statistics
db.getAssetStats(): {
  totalAssets: number;
  totalDownloads: number;
  duplicatesAvoided: number;
  diskSpaceSavedBytes: number;
}
```

## Example Scenario

### Archiving a Site Across 5 Years

```
Timeline: 2020-2024 (1 snapshot per year)
Assets per snapshot: 50 (10 images, 20 CSS/JS, 20 other)
```

**Without Deduplication:**
- Downloads: 250 (50 × 5)
- Disk usage: ~125MB (assuming 500KB average)
- Time: ~250 requests to Wayback Machine

**With Deduplication:**
- First snapshot: 50 downloads (builds cache)
- Subsequent snapshots: ~10-15 downloads each (logos/chrome unchanged)
- Total downloads: ~100 (60% reduction)
- Disk usage: ~65MB (48% savings via hardlinks)
- Time: ~100 HTTP requests + 150 database lookups (much faster)

**Result:**
- ✅ 60% fewer downloads (avoids rate limits)
- ✅ 48% less disk space
- ✅ ~2-3× faster archiving

## Troubleshooting

### "Failed to create hardlink"

**Cause:** Files on different filesystems

**Solution:** Ensure output directory is on same filesystem as assets, or fallback to copying:

```typescript
try {
  fs.linkSync(source, dest);
} catch (error) {
  fs.copyFileSync(source, dest); // Fallback
}
```

### Hash computation slow

**Cause:** Large files (videos, high-res images)

**Solution:** Skip hashing for files above threshold:

```typescript
if (sizeBytes > 10 * 1024 * 1024) { // > 10MB
  // Skip content-hash deduplication for large files
  // Still benefit from URL-based caching
}
```

### Database growing large

**Monitor:** The assets table grows with unique assets

**Maintenance:**
```sql
-- Check table size
SELECT COUNT(*) FROM assets;

-- Clean up old/orphaned entries if needed
DELETE FROM assets WHERE domain = 'old-domain.com';
VACUUM; -- Reclaim space
```

## Future Enhancements

1. **Perceptual hashing** for near-duplicate images
2. **Compression** of stored assets
3. **CDN detection** (same asset from multiple CDNs)
4. **Asset versioning** tracking
5. **Distributed caching** across multiple archives

## Related Files

- **Database Schema**: `/root/projects/justSteve/src/services/DatabaseService.ts:129-158`
- **Deduplication Logic**: `/root/projects/justSteve/src/domain/assets/AssetFetcher.ts:90-238`
- **Asset Types**: `/root/projects/justSteve/src/domain/models/AssetTypes.ts`

## References

- [Hardlinks vs Symlinks](https://www.redhat.com/sysadmin/linking-linux-explained)
- [SHA-256 Hashing](https://en.wikipedia.org/wiki/SHA-2)
- [Wayback Machine CDX API](https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server)
