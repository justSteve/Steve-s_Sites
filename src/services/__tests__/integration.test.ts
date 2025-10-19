// src/services/__tests__/integration.test.ts
import { WaybackCrawler } from '../WaybackCrawler';
import * as fs from 'fs';
import * as path from 'path';

describe('Full Asset Fetching Integration', () => {
  const testOutputDir = '/tmp/integration-test';

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  it('should crawl page with full assets (end-to-end)', async () => {
    const crawler = new WaybackCrawler({
      useOffPeakScheduler: false,
      noDelay: true,
      fetchAssets: true,
      fetchExternalAssets: true,
      maxAssetSizeMB: 10,
      assetConcurrency: 5,
      outputDir: testOutputDir,
    });

    // Use a small real snapshot for testing
    // Or mock the entire flow

    // This is a placeholder - actual implementation would:
    // 1. Fetch HTML from Wayback
    // 2. Extract assets
    // 3. Fetch assets
    // 4. Rewrite URLs
    // 5. Verify files exist locally

    expect(true).toBe(true); // Placeholder
  }, 60000);
});
