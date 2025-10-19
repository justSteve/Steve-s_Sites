// src/services/URLRewriter.ts
import * as cheerio from 'cheerio';
import { URL } from 'url';

/**
 * Rewrites URLs in HTML and CSS to work with local file structure
 */
export class URLRewriter {
  private baseDomain: string;

  constructor(baseDomain: string) {
    this.baseDomain = baseDomain;
  }

  /**
   * Rewrite all asset URLs in HTML to relative paths
   */
  public rewriteHtml(html: string, baseUrl: string): string {
    const $ = cheerio.load(html);

    // Rewrite CSS links
    $('link[rel="stylesheet"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && !this.isDataUri(href) && !this.isAnchor(href)) {
        const rewritten = this.rewriteUrl(href, baseUrl);
        $(element).attr('href', rewritten);
      }
    });

    // Rewrite scripts
    $('script[src]').each((_, element) => {
      const src = $(element).attr('src');
      if (src && !this.isDataUri(src)) {
        const rewritten = this.rewriteUrl(src, baseUrl);
        $(element).attr('src', rewritten);
      }
    });

    // Rewrite images
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      if (src && !this.isDataUri(src)) {
        const rewritten = this.rewriteUrl(src, baseUrl);
        $(element).attr('src', rewritten);
      }
    });

    // Rewrite source elements
    $('source').each((_, element) => {
      const src = $(element).attr('src');
      const srcset = $(element).attr('srcset');

      if (src && !this.isDataUri(src)) {
        $(element).attr('src', this.rewriteUrl(src, baseUrl));
      }

      if (srcset && !this.isDataUri(srcset)) {
        const rewritten = this.rewriteUrl(srcset.split(',')[0].trim().split(' ')[0], baseUrl);
        $(element).attr('srcset', rewritten);
      }
    });

    // Rewrite video/audio
    $('video, audio').each((_, element) => {
      const src = $(element).attr('src');
      if (src && !this.isDataUri(src)) {
        $(element).attr('src', this.rewriteUrl(src, baseUrl));
      }
    });

    return $.html();
  }

  /**
   * Rewrite url() references in CSS
   */
  public rewriteCss(css: string, cssFileUrl: string): string {
    // Rewrite url() patterns
    const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;

    return css.replace(urlRegex, (match, url) => {
      if (this.isDataUri(url)) {
        return match; // Preserve data URIs
      }

      const rewritten = this.rewriteUrlForCss(url, cssFileUrl);
      return `url("${rewritten}")`;
    });
  }

  /**
   * Rewrite a single URL to relative path for HTML
   */
  private rewriteUrl(url: string, baseUrl: string): string {
    try {
      const absoluteUrl = new URL(url, baseUrl);
      const isExternal = this.isExternalDomain(absoluteUrl.hostname);

      if (isExternal) {
        // External: assets/external/{domain}/{path}
        const externalPath = absoluteUrl.pathname.startsWith('/')
          ? absoluteUrl.pathname.substring(1)
          : absoluteUrl.pathname;
        return `assets/external/${absoluteUrl.hostname}/${externalPath}`;
      } else {
        // Same domain: assets/{path}
        const assetPath = absoluteUrl.pathname.startsWith('/')
          ? absoluteUrl.pathname.substring(1)
          : absoluteUrl.pathname;
        return `assets/${assetPath}`;
      }
    } catch {
      return url; // Return unchanged if parsing fails
    }
  }

  /**
   * Rewrite URL for CSS (needs ../ prefix since CSS is in assets/css/)
   */
  private rewriteUrlForCss(url: string, cssFileUrl: string): string {
    try {
      const absoluteUrl = new URL(url, cssFileUrl);
      const isExternal = this.isExternalDomain(absoluteUrl.hostname);

      if (isExternal) {
        const externalPath = absoluteUrl.pathname.startsWith('/')
          ? absoluteUrl.pathname.substring(1)
          : absoluteUrl.pathname;
        return `../external/${absoluteUrl.hostname}/${externalPath}`;
      } else {
        const assetPath = absoluteUrl.pathname.startsWith('/')
          ? absoluteUrl.pathname.substring(1)
          : absoluteUrl.pathname;
        return `../${assetPath}`;
      }
    } catch {
      return url;
    }
  }

  /**
   * Check if hostname is from an external domain
   */
  private isExternalDomain(hostname: string): boolean {
    // Exact match or www. prefix is same domain
    if (hostname === this.baseDomain || hostname === `www.${this.baseDomain}`) {
      return false;
    }
    // Otherwise it's external
    return true;
  }

  /**
   * Check if URL is a data URI
   */
  private isDataUri(url: string): boolean {
    return url.trim().startsWith('data:');
  }

  /**
   * Check if URL is just an anchor
   */
  private isAnchor(url: string): boolean {
    return url.trim().startsWith('#');
  }
}
