// src/models/__tests__/AssetTypes.test.ts
import { AssetReference, AssetType, SkippedAsset, AssetManifest } from '../AssetTypes';

describe('AssetTypes', () => {
  describe('AssetReference', () => {
    it('should create a valid asset reference', () => {
      const asset: AssetReference = {
        url: 'https://example.com/style.css',
        type: 'css',
        sourceFile: 'index.html',
        isExternal: false,
      };

      expect(asset.url).toBe('https://example.com/style.css');
      expect(asset.type).toBe('css');
      expect(asset.sourceFile).toBe('index.html');
      expect(asset.isExternal).toBe(false);
    });

    it('should identify external assets', () => {
      const asset: AssetReference = {
        url: 'https://cdn.external.com/script.js',
        type: 'js',
        sourceFile: 'index.html',
        isExternal: true,
      };

      expect(asset.isExternal).toBe(true);
    });
  });

  describe('SkippedAsset', () => {
    it('should create a skipped asset record', () => {
      const skipped: SkippedAsset = {
        url: 'https://example.com/video.mp4',
        reason: 'size_limit',
        sizeMB: 125.4,
        waybackUrl: 'https://web.archive.org/web/20230615120000/https://example.com/video.mp4',
      };

      expect(skipped.reason).toBe('size_limit');
      expect(skipped.sizeMB).toBe(125.4);
    });
  });

  describe('AssetManifest', () => {
    it('should create a complete manifest', () => {
      const manifest: AssetManifest = {
        domain: 'example.com',
        timestamp: '20230615120000',
        crawledAt: new Date().toISOString(),
        pages: ['index.html', 'about.html'],
        assets: {
          total: 50,
          byType: { css: 10, js: 15, image: 20, font: 5 },
          totalSizeMB: 12.5,
          externalDomains: ['cdn.example.com'],
        },
        skippedCount: 2,
      };

      expect(manifest.assets.total).toBe(50);
      expect(manifest.skippedCount).toBe(2);
    });
  });
});
