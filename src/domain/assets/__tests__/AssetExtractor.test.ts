import { AssetExtractor } from '../AssetExtractor';
import { AssetReference } from '../../models/AssetTypes';

describe('AssetExtractor', () => {
  let extractor: AssetExtractor;
  const baseDomain = 'example.com';

  beforeEach(() => {
    extractor = new AssetExtractor(baseDomain);
  });

  describe('extractFromHtml', () => {
    it('should extract CSS link tags', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="/css/style.css">
            <link rel="stylesheet" href="https://cdn.example.com/bootstrap.css">
          </head>
        </html>
      `;

      const assets = extractor.extractFromHtml(html, 'https://example.com', 'index.html');

      const cssAssets = assets.filter(a => a.type === 'css');
      expect(cssAssets.length).toBe(2);

      const localCss = cssAssets.find(a => a.url.includes('style.css'));
      expect(localCss?.isExternal).toBe(false);
      expect(localCss?.url).toBe('https://example.com/css/style.css');

      const externalCss = cssAssets.find(a => a.url.includes('bootstrap.css'));
      expect(externalCss?.isExternal).toBe(true);
    });

    it('should extract script tags', () => {
      const html = `
        <html>
          <body>
            <script src="/js/main.js"></script>
            <script src="https://ajax.googleapis.com/jquery.min.js"></script>
          </body>
        </html>
      `;

      const assets = extractor.extractFromHtml(html, 'https://example.com', 'index.html');

      const jsAssets = assets.filter(a => a.type === 'js');
      expect(jsAssets.length).toBe(2);
    });

    it('should extract image tags', () => {
      const html = `
        <html>
          <body>
            <img src="/images/logo.png" alt="Logo">
            <img src="https://cdn.example.com/icon.jpg">
            <picture>
              <source srcset="/images/hero.webp" type="image/webp">
              <img src="/images/hero.jpg">
            </picture>
          </body>
        </html>
      `;

      const assets = extractor.extractFromHtml(html, 'https://example.com', 'page.html');

      const imageAssets = assets.filter(a => a.type === 'image');
      expect(imageAssets.length).toBeGreaterThanOrEqual(3);
    });

    it('should skip data URIs', () => {
      const html = `
        <html>
          <body>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANS...">
            <img src="/real-image.png">
          </body>
        </html>
      `;

      const assets = extractor.extractFromHtml(html, 'https://example.com', 'index.html');

      const imageAssets = assets.filter(a => a.type === 'image');
      expect(imageAssets.length).toBe(1);
      expect(imageAssets[0].url).toContain('real-image.png');
    });

    it('should handle relative URLs', () => {
      const html = '<img src="../images/photo.jpg">';

      const assets = extractor.extractFromHtml(html, 'https://example.com/pages/about.html', 'about.html');

      expect(assets[0].url).toBe('https://example.com/images/photo.jpg');
    });
  });

  describe('extractFromCss', () => {
    it('should extract url() references', () => {
      const css = `
        body {
          background-image: url('/images/bg.jpg');
        }
        @font-face {
          font-family: 'MyFont';
          src: url('https://fonts.example.com/font.woff2');
        }
        .icon {
          background: url("../icons/arrow.svg");
        }
      `;

      const assets = extractor.extractFromCss(css, 'https://example.com/css/style.css', 'style.css');

      expect(assets.length).toBe(3);

      const fontAsset = assets.find(a => a.url.includes('font.woff'));
      expect(fontAsset?.type).toBe('font');
      expect(fontAsset?.isExternal).toBe(true);
    });

    it('should extract @import rules', () => {
      const css = `
        @import url('/css/reset.css');
        @import "https://fonts.googleapis.com/css?family=Roboto";

        body { color: black; }
      `;

      const assets = extractor.extractFromCss(css, 'https://example.com/css/main.css', 'main.css');

      const cssAssets = assets.filter(a => a.type === 'css');
      expect(cssAssets.length).toBe(2);
    });
  });

  describe('determineAssetType', () => {
    it('should identify asset types by extension', () => {
      expect(extractor['determineAssetType']('/style.css')).toBe('css');
      expect(extractor['determineAssetType']('/script.js')).toBe('js');
      expect(extractor['determineAssetType']('/image.png')).toBe('image');
      expect(extractor['determineAssetType']('/image.jpg')).toBe('image');
      expect(extractor['determineAssetType']('/image.gif')).toBe('image');
      expect(extractor['determineAssetType']('/image.svg')).toBe('image');
      expect(extractor['determineAssetType']('/font.woff')).toBe('font');
      expect(extractor['determineAssetType']('/font.woff2')).toBe('font');
      expect(extractor['determineAssetType']('/font.ttf')).toBe('font');
      expect(extractor['determineAssetType']('/video.mp4')).toBe('video');
      expect(extractor['determineAssetType']('/audio.mp3')).toBe('audio');
      expect(extractor['determineAssetType']('/data.json')).toBe('other');
    });
  });
});
