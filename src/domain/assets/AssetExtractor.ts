import * as cheerio from 'cheerio';
import { URL } from 'url';
import { AssetReference, AssetType } from '../models/AssetTypes';

/**
 * Extracts asset references from HTML and CSS files
 */
export class AssetExtractor {
  private baseDomain: string;

  constructor(baseDomain: string) {
    this.baseDomain = baseDomain;
  }

  /**
   * Extract all asset references from HTML content
   */
  public extractFromHtml(html: string, baseUrl: string, sourceFile: string): AssetReference[] {
    const assets: AssetReference[] = [];
    const $ = cheerio.load(html);

    // Extract CSS links
    $('link[rel="stylesheet"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && !this.isDataUri(href)) {
        assets.push(this.createAssetReference(href, baseUrl, sourceFile, 'css'));
      }
    });

    // Extract scripts
    $('script[src]').each((_, element) => {
      const src = $(element).attr('src');
      if (src && !this.isDataUri(src)) {
        assets.push(this.createAssetReference(src, baseUrl, sourceFile, 'js'));
      }
    });

    // Extract images (img, source, picture)
    $('img, source').each((_, element) => {
      const src = $(element).attr('src') || $(element).attr('srcset');
      if (src && !this.isDataUri(src)) {
        // Handle srcset (take first image)
        const firstSrc = src.split(',')[0].trim().split(' ')[0];
        assets.push(this.createAssetReference(firstSrc, baseUrl, sourceFile, 'image'));
      }
    });

    // Extract video/audio sources
    $('video, audio').each((_, element) => {
      const src = $(element).attr('src');
      if (src && !this.isDataUri(src)) {
        const tagName = $(element).prop('tagName');
        const type = tagName?.toLowerCase() === 'video' ? 'video' : 'audio';
        assets.push(this.createAssetReference(src, baseUrl, sourceFile, type as AssetType));
      }
    });

    $('source').each((_, element) => {
      const src = $(element).attr('src');
      const parent = $(element).parent().prop('tagName')?.toLowerCase();
      if (src && !this.isDataUri(src) && (parent === 'video' || parent === 'audio')) {
        assets.push(this.createAssetReference(src, baseUrl, sourceFile, parent as AssetType));
      }
    });

    return assets;
  }

  /**
   * Extract asset references from CSS content
   */
  public extractFromCss(css: string, baseUrl: string, sourceFile: string): AssetReference[] {
    const assets: AssetReference[] = [];
    const seenUrls = new Set<string>();

    // Extract @import rules first (to avoid duplicates with url() regex)
    const importRegex = /@import\s+(?:url\(['"]?([^'"()]+)['"]?\)|['"]([^'"]+)['"])/g;
    let match;
    while ((match = importRegex.exec(css)) !== null) {
      const url = (match[1] || match[2]).trim();
      if (!this.isDataUri(url) && !seenUrls.has(url)) {
        seenUrls.add(url);
        assets.push(this.createAssetReference(url, baseUrl, sourceFile, 'css'));
      }
    }

    // Extract url() references
    const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/g;
    while ((match = urlRegex.exec(css)) !== null) {
      const url = match[1];
      if (!this.isDataUri(url) && !seenUrls.has(url)) {
        seenUrls.add(url);
        const type = this.determineAssetType(url);
        assets.push(this.createAssetReference(url, baseUrl, sourceFile, type));
      }
    }

    return assets;
  }

  /**
   * Create an AssetReference object with resolved URL
   */
  private createAssetReference(
    url: string,
    baseUrl: string,
    sourceFile: string,
    type: AssetType
  ): AssetReference {
    // Resolve relative URLs
    const absoluteUrl = this.resolveUrl(url, baseUrl);

    // Determine if external
    const isExternal = this.isExternalUrl(absoluteUrl);

    return {
      url: absoluteUrl,
      type,
      sourceFile,
      isExternal,
    };
  }

  /**
   * Resolve a potentially relative URL to absolute
   */
  private resolveUrl(url: string, baseUrl: string): string {
    try {
      const resolved = new URL(url, baseUrl);
      return resolved.href;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL is from external domain
   */
  private isExternalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Only consider exact match as same domain (subdomains are external)
      return urlObj.hostname !== this.baseDomain;
    } catch {
      return false;
    }
  }

  /**
   * Check if URL is a data URI
   */
  private isDataUri(url: string): boolean {
    return url.trim().startsWith('data:');
  }

  /**
   * Determine asset type from URL/extension
   */
  private determineAssetType(url: string): AssetType {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.endsWith('.css') || lowerUrl.includes('.css?')) return 'css';
    if (lowerUrl.endsWith('.js') || lowerUrl.includes('.js?')) return 'js';
    if (lowerUrl.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i)) return 'image';
    if (lowerUrl.match(/\.(woff|woff2|ttf|otf|eot)$/i)) return 'font';
    if (lowerUrl.match(/\.(mp4|webm|ogg|avi|mov)$/i)) return 'video';
    if (lowerUrl.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) return 'audio';

    return 'other';
  }
}
