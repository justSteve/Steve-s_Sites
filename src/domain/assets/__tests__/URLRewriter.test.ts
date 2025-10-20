// src/services/__tests__/URLRewriter.test.ts
import { URLRewriter } from '../URLRewriter';

describe('URLRewriter', () => {
  let rewriter: URLRewriter;
  const domain = 'example.com';

  beforeEach(() => {
    rewriter = new URLRewriter(domain);
  });

  describe('rewriteHtml', () => {
    it('should rewrite CSS links to relative paths', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="https://example.com/css/style.css">
            <link rel="stylesheet" href="/css/main.css">
          </head>
        </html>
      `;

      const rewritten = rewriter.rewriteHtml(html, 'https://example.com');

      expect(rewritten).toContain('href="assets/css/style.css"');
      expect(rewritten).toContain('href="assets/css/main.css"');
    });

    it('should rewrite script sources to relative paths', () => {
      const html = `
        <html>
          <body>
            <script src="/js/main.js"></script>
            <script src="https://example.com/js/app.js"></script>
          </body>
        </html>
      `;

      const rewritten = rewriter.rewriteHtml(html, 'https://example.com');

      expect(rewritten).toContain('src="assets/js/main.js"');
      expect(rewritten).toContain('src="assets/js/app.js"');
    });

    it('should rewrite image sources', () => {
      const html = `
        <img src="/images/logo.png">
        <img src="https://example.com/photos/hero.jpg">
      `;

      const rewritten = rewriter.rewriteHtml(html, 'https://example.com');

      expect(rewritten).toContain('src="assets/images/logo.png"');
      expect(rewritten).toContain('src="assets/photos/hero.jpg"');
    });

    it('should rewrite external assets to external/ directory', () => {
      const html = `
        <link rel="stylesheet" href="https://cdn.external.com/bootstrap.css">
        <script src="https://ajax.googleapis.com/jquery.min.js"></script>
      `;

      const rewritten = rewriter.rewriteHtml(html, 'https://example.com');

      expect(rewritten).toContain('href="assets/external/cdn.external.com/bootstrap.css"');
      expect(rewritten).toContain('src="assets/external/ajax.googleapis.com/jquery.min.js"');
    });

    it('should preserve data URIs unchanged', () => {
      const html = `
        <img src="data:image/png;base64,iVBORw0KGgoAAAANS...">
      `;

      const rewritten = rewriter.rewriteHtml(html, 'https://example.com');

      expect(rewritten).toContain('data:image/png;base64');
    });

    it('should preserve anchor links', () => {
      const html = `
        <a href="#section1">Jump to section</a>
        <a href="page.html#top">Other page</a>
      `;

      const rewritten = rewriter.rewriteHtml(html, 'https://example.com');

      expect(rewritten).toContain('href="#section1"');
      expect(rewritten).toContain('href="page.html#top"');
    });
  });

  describe('rewriteCss', () => {
    it('should rewrite url() references', () => {
      const css = `
        body {
          background-image: url('/images/bg.jpg');
        }
        .icon {
          background: url("https://example.com/icons/arrow.svg");
        }
      `;

      const rewritten = rewriter.rewriteCss(css, 'https://example.com/css/style.css');

      expect(rewritten).toContain('url("../images/bg.jpg")');
      expect(rewritten).toContain('url("../icons/arrow.svg")');
    });

    it('should rewrite external font URLs', () => {
      const css = `
        @font-face {
          font-family: 'MyFont';
          src: url('https://fonts.example.com/font.woff2');
        }
      `;

      const rewritten = rewriter.rewriteCss(css, 'https://example.com/css/fonts.css');

      expect(rewritten).toContain('url("../external/fonts.example.com/font.woff2")');
    });

    it('should preserve data URIs in CSS', () => {
      const css = `
        .icon {
          background: url('data:image/svg+xml;base64,PHN2Zy...');
        }
      `;

      const rewritten = rewriter.rewriteCss(css, 'https://example.com/css/style.css');

      expect(rewritten).toContain('data:image/svg+xml');
    });
  });
});
