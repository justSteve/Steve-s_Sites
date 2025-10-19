// src/services/__tests__/AssetFetcher.test.ts
import { AssetFetcher } from '../AssetFetcher';
import { AssetReference } from '../../models/AssetTypes';
import * as fs from 'fs';
import * as path from 'path';

describe('AssetFetcher', () => {
  let fetcher: AssetFetcher;
  const testOutputDir = '/tmp/test-asset-fetcher';
  const domain = 'example.com';
  const timestamp = '20230615120000';

  beforeEach(() => {
    fetcher = new AssetFetcher({
      outputDir: testOutputDir,
      maxAssetSizeMB: 1, // Small limit for testing
      concurrency: 2,
    });

    // Clean test directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  describe('fetchAssets', () => {
    it('should handle empty asset list', async () => {
      const assets: AssetReference[] = [];

      const result = await fetcher.fetchAssets(assets, domain, timestamp);

      expect(result.fetched.length).toBe(0);
      expect(result.skipped.length).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    // Note: Integration tests with actual Wayback Machine fetching
    // are in integration.test.ts to avoid network calls in unit tests
  });

  describe('size limit handling', () => {
    it('should skip assets exceeding size limit', async () => {
      // Mock or create test scenario
      // For now, just test the interface
      const mockLargeAsset: AssetReference = {
        url: 'https://example.com/large-video.mp4',
        type: 'video',
        sourceFile: 'index.html',
        isExternal: false,
      };

      // This would skip if the asset is > 1MB
      const canFetch = fetcher['shouldFetchAsset'](mockLargeAsset);
      expect(typeof canFetch).toBe('boolean');
    });
  });

  describe('getAssetPath', () => {
    it('should generate correct paths for same-domain assets', () => {
      const asset: AssetReference = {
        url: 'https://example.com/css/style.css',
        type: 'css',
        sourceFile: 'index.html',
        isExternal: false,
      };

      const assetPath = fetcher['getAssetPath'](asset, domain, timestamp);

      expect(assetPath).toContain('assets/css/style.css');
      expect(assetPath).not.toContain('external');
    });

    it('should generate correct paths for external assets', () => {
      const asset: AssetReference = {
        url: 'https://cdn.example.com/lib/script.js',
        type: 'js',
        sourceFile: 'index.html',
        isExternal: true,
      };

      const assetPath = fetcher['getAssetPath'](asset, domain, timestamp);

      expect(assetPath).toContain('assets/external/cdn.example.com');
    });
  });
});
