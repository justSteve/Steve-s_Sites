#!/usr/bin/env python3
"""
Hybrid Wayback Crawler

Uses waybackpack for reliable HTML downloading with proper rate limiting,
then fetches assets separately with our own rate limiting and deduplication.

Usage:
    python python/hybrid_crawler.py --domain juststeve.com --from-date 1997 --to-date 2010
"""

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# Try to import waybackpack
try:
    from waybackpack import Pack
    from waybackpack.cdx import search as cdx_search
except ImportError:
    print("Error: waybackpack not installed. Run: pip install waybackpack")
    sys.exit(1)


class HybridCrawler:
    """
    Hybrid crawler that uses waybackpack for HTML and custom asset fetching.
    """

    def __init__(
        self,
        domain: str,
        output_dir: str = "archived_pages",
        html_delay: float = 2.0,
        asset_delay: float = 0.5,
        max_retries: int = 3,
        db_path: str = "crawler_hybrid.db",
    ):
        self.domain = domain
        self.output_dir = Path(output_dir)
        self.html_delay = html_delay
        self.asset_delay = asset_delay
        self.max_retries = max_retries
        self.db_path = db_path

        # Load auth from .env
        self.auth = self._load_auth()

        # Create session with auth
        self.session = requests.Session()
        self.session.headers["User-Agent"] = (
            f"justSteve-archiver/2.0 (personal archive; hybrid crawler)"
        )
        if self.auth:
            self.session.cookies.set("logged-in-user", self.auth["user"])
            self.session.cookies.set("logged-in-sig", self.auth["sig"])

        # Initialize database
        self._init_db()

        # Stats
        self.stats = {
            "html_fetched": 0,
            "html_failed": 0,
            "assets_fetched": 0,
            "assets_skipped": 0,
            "assets_cached": 0,
            "assets_failed": 0,
        }

    def _load_auth(self) -> Optional[Dict[str, str]]:
        """Load authentication from .env file."""
        env_path = Path(__file__).parent.parent / ".env"
        if not env_path.exists():
            print("Warning: No .env file found. Running without authentication.")
            return None

        auth = {}
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    value = value.strip().strip("\"'")
                    if key == "IA_LOGGED_IN_USER":
                        auth["user"] = value
                    elif key == "IA_LOGGED_IN_SIG":
                        auth["sig"] = value

        if "user" in auth and "sig" in auth:
            print(f"Loaded auth for: {auth['user'][:20]}...")
            return auth
        return None

    def _init_db(self):
        """Initialize SQLite database for tracking."""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row

        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS pages (
                url TEXT,
                timestamp TEXT,
                status TEXT DEFAULT 'pending',
                local_path TEXT,
                fetched_at TIMESTAMP,
                error TEXT,
                PRIMARY KEY (url, timestamp)
            );

            CREATE TABLE IF NOT EXISTS assets (
                wayback_url TEXT PRIMARY KEY,
                original_url TEXT,
                content_hash TEXT,
                local_path TEXT,
                size_bytes INTEGER,
                mime_type TEXT,
                domain TEXT,
                timestamp TEXT,
                download_count INTEGER DEFAULT 1,
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_assets_hash ON assets(content_hash);
            CREATE INDEX IF NOT EXISTS idx_assets_domain ON assets(domain, timestamp);
        """)
        self.conn.commit()

    def get_snapshots(self, from_date: str, to_date: str) -> List[Tuple[str, str]]:
        """Get list of snapshots from CDX API."""
        print(f"Querying CDX API for {self.domain} snapshots...")

        url = f"http://www.{self.domain}/"
        snapshots = []

        try:
            results = cdx_search(url, from_date=from_date, to_date=to_date)
            for result in results:
                # Handle both dict and object formats
                if isinstance(result, dict):
                    snapshots.append((result["timestamp"], result["original"]))
                else:
                    snapshots.append((result.timestamp, result.original))
            print(f"Found {len(snapshots)} snapshots")
        except Exception as e:
            print(f"CDX search failed: {e}")
            import traceback
            traceback.print_exc()

        return snapshots

    def fetch_html_page(self, url: str, timestamp: str) -> Optional[str]:
        """Fetch a single HTML page from Wayback with --raw equivalent."""
        wayback_url = f"https://web.archive.org/web/{timestamp}id_/{url}"

        for attempt in range(self.max_retries):
            try:
                response = self.session.get(wayback_url, timeout=30)

                if response.status_code == 200:
                    return response.text
                elif response.status_code == 404:
                    print(f"  404: {url}")
                    return None
                elif response.status_code == 429:
                    wait = int(response.headers.get("Retry-After", 60))
                    print(f"  Rate limited, waiting {wait}s...")
                    time.sleep(wait)
                else:
                    print(f"  HTTP {response.status_code}: {url}")

            except requests.RequestException as e:
                print(f"  Error (attempt {attempt + 1}): {e}")
                time.sleep(self.html_delay * (attempt + 1))

        return None

    def extract_assets(self, html: str, base_url: str) -> List[Dict]:
        """Extract asset references from HTML."""
        assets = []
        seen_urls = set()

        soup = BeautifulSoup(html, "html.parser")

        # Images
        for tag in soup.find_all(["img", "source"]):
            src = tag.get("src") or tag.get("srcset", "").split(",")[0].split()[0]
            if src and not src.startswith("data:"):
                assets.append({"url": src, "type": "image"})

        # CSS
        for tag in soup.find_all("link", rel="stylesheet"):
            href = tag.get("href")
            if href and not href.startswith("data:"):
                assets.append({"url": href, "type": "css"})

        # Scripts
        for tag in soup.find_all("script", src=True):
            src = tag.get("src")
            if src and not src.startswith("data:"):
                assets.append({"url": src, "type": "js"})

        # Background images in style attributes
        for tag in soup.find_all(style=True):
            style = tag.get("style", "")
            urls = re.findall(r'url\(["\']?([^"\'()]+)["\']?\)', style)
            for url in urls:
                if not url.startswith("data:"):
                    assets.append({"url": url, "type": "image"})

        # Body background
        body = soup.find("body")
        if body and body.get("background"):
            assets.append({"url": body.get("background"), "type": "image"})

        # Resolve URLs and dedupe
        resolved = []
        for asset in assets:
            try:
                abs_url = urljoin(base_url, asset["url"])
                if abs_url not in seen_urls:
                    seen_urls.add(abs_url)
                    resolved.append({
                        "url": abs_url,
                        "type": asset["type"],
                        "is_external": urlparse(abs_url).netloc != f"www.{self.domain}"
                                       and urlparse(abs_url).netloc != self.domain,
                    })
            except Exception:
                pass

        return resolved

    def fetch_asset(self, asset: Dict, timestamp: str) -> Optional[bytes]:
        """Fetch a single asset from Wayback."""
        # Build Wayback URL with appropriate modifier
        modifier = "im_" if asset["type"] == "image" else ""
        if asset["type"] == "css":
            modifier = "cs_"
        elif asset["type"] == "js":
            modifier = "js_"

        wayback_url = f"https://web.archive.org/web/{timestamp}{modifier}/{asset['url']}"

        # Check cache first
        cached = self.conn.execute(
            "SELECT local_path, content_hash FROM assets WHERE wayback_url = ?",
            (wayback_url,)
        ).fetchone()

        if cached and cached["local_path"] and os.path.exists(cached["local_path"]):
            self.conn.execute(
                "UPDATE assets SET download_count = download_count + 1 WHERE wayback_url = ?",
                (wayback_url,)
            )
            self.conn.commit()
            self.stats["assets_cached"] += 1
            return None  # Already have it

        for attempt in range(self.max_retries):
            try:
                response = self.session.get(wayback_url, timeout=30)

                if response.status_code == 200:
                    return response.content
                elif response.status_code == 404:
                    return None
                elif response.status_code == 429:
                    wait = int(response.headers.get("Retry-After", 60))
                    print(f"    Rate limited on asset, waiting {wait}s...")
                    time.sleep(wait)
                else:
                    pass  # Retry

            except requests.RequestException as e:
                time.sleep(self.asset_delay * (attempt + 1))

        return None

    def save_asset(
        self,
        content: bytes,
        asset: Dict,
        timestamp: str,
    ) -> str:
        """Save asset to disk with deduplication."""
        content_hash = hashlib.sha256(content).hexdigest()

        # Check for content duplicate
        existing = self.conn.execute(
            "SELECT local_path FROM assets WHERE content_hash = ?",
            (content_hash,)
        ).fetchone()

        if existing and existing["local_path"] and os.path.exists(existing["local_path"]):
            # Content duplicate - just record it
            local_path = existing["local_path"]
        else:
            # New content - save to disk
            parsed = urlparse(asset["url"])
            path_parts = parsed.path.strip("/").split("/")
            if not path_parts[-1]:
                path_parts[-1] = "index"

            if asset["is_external"]:
                local_path = self.output_dir / self.domain / timestamp / "assets" / "external" / parsed.netloc / "/".join(path_parts)
            else:
                local_path = self.output_dir / self.domain / timestamp / "assets" / "/".join(path_parts)

            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(content)
            local_path = str(local_path)

        # Record in database
        modifier = "im_" if asset["type"] == "image" else ("cs_" if asset["type"] == "css" else ("js_" if asset["type"] == "js" else ""))
        wayback_url = f"https://web.archive.org/web/{timestamp}{modifier}/{asset['url']}"

        self.conn.execute("""
            INSERT OR REPLACE INTO assets
            (wayback_url, original_url, content_hash, local_path, size_bytes, domain, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            wayback_url,
            asset["url"],
            content_hash,
            local_path,
            len(content),
            self.domain,
            timestamp,
        ))
        self.conn.commit()

        return local_path

    def save_html(self, html: str, url: str, timestamp: str) -> str:
        """Save HTML page to disk."""
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]

        if not path_parts or not path_parts[-1].endswith((".html", ".htm")):
            path_parts.append("index.html")

        local_path = self.output_dir / self.domain / timestamp / Path(*path_parts)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_text(html, encoding="utf-8")

        return str(local_path)

    def process_snapshot(self, timestamp: str, url: str) -> bool:
        """Process a single snapshot: fetch HTML and assets."""
        print(f"\n[{timestamp}] {url}")

        # Check if already processed
        existing = self.conn.execute(
            "SELECT status FROM pages WHERE url = ? AND timestamp = ?",
            (url, timestamp)
        ).fetchone()

        if existing and existing["status"] == "completed":
            print("  Already processed, skipping")
            return True

        # Fetch HTML
        html = self.fetch_html_page(url, timestamp)
        if not html:
            self.conn.execute(
                "INSERT OR REPLACE INTO pages (url, timestamp, status, error) VALUES (?, ?, 'failed', 'fetch_failed')",
                (url, timestamp)
            )
            self.conn.commit()
            self.stats["html_failed"] += 1
            return False

        # Save HTML
        local_path = self.save_html(html, url, timestamp)
        self.stats["html_fetched"] += 1
        print(f"  HTML saved: {local_path}")

        # Extract and fetch assets
        assets = self.extract_assets(html, url)
        print(f"  Found {len(assets)} assets")

        for i, asset in enumerate(assets):
            time.sleep(self.asset_delay)

            content = self.fetch_asset(asset, timestamp)
            if content:
                self.save_asset(content, asset, timestamp)
                self.stats["assets_fetched"] += 1
            elif content is None and self.stats["assets_cached"] > 0:
                pass  # Cached
            else:
                self.stats["assets_failed"] += 1

            # Progress every 10 assets
            if (i + 1) % 10 == 0:
                print(f"    Assets: {i + 1}/{len(assets)}")

        # Mark as completed
        self.conn.execute("""
            INSERT OR REPLACE INTO pages (url, timestamp, status, local_path, fetched_at)
            VALUES (?, ?, 'completed', ?, CURRENT_TIMESTAMP)
        """, (url, timestamp, local_path))
        self.conn.commit()

        return True

    def run(self, from_date: str, to_date: str):
        """Run the hybrid crawler."""
        print("=" * 60)
        print("Hybrid Wayback Crawler")
        print("=" * 60)
        print(f"Domain: {self.domain}")
        print(f"Date range: {from_date} - {to_date}")
        print(f"HTML delay: {self.html_delay}s, Asset delay: {self.asset_delay}s")
        print("=" * 60)

        # Get snapshot list
        snapshots = self.get_snapshots(from_date, to_date)
        if not snapshots:
            print("No snapshots found!")
            return

        # Process each snapshot
        start_time = time.time()
        for i, (timestamp, url) in enumerate(snapshots):
            print(f"\nProgress: {i + 1}/{len(snapshots)}")

            try:
                self.process_snapshot(timestamp, url)
            except KeyboardInterrupt:
                print("\n\nInterrupted by user")
                break
            except Exception as e:
                print(f"  Error: {e}")
                self.stats["html_failed"] += 1

            # Delay before next page
            time.sleep(self.html_delay)

        # Summary
        elapsed = time.time() - start_time
        print("\n" + "=" * 60)
        print("CRAWL COMPLETE")
        print("=" * 60)
        print(f"Time: {elapsed / 60:.1f} minutes")
        print(f"HTML: {self.stats['html_fetched']} fetched, {self.stats['html_failed']} failed")
        print(f"Assets: {self.stats['assets_fetched']} fetched, {self.stats['assets_cached']} cached, {self.stats['assets_failed']} failed")
        print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Hybrid Wayback Crawler")
    parser.add_argument("--domain", default="juststeve.com", help="Domain to crawl")
    parser.add_argument("--from-date", default="1997", help="Start date (YYYY or YYYYMMDD)")
    parser.add_argument("--to-date", default="2010", help="End date (YYYY or YYYYMMDD)")
    parser.add_argument("--output", default="archived_pages", help="Output directory")
    parser.add_argument("--html-delay", type=float, default=3.0, help="Delay between pages (seconds)")
    parser.add_argument("--asset-delay", type=float, default=0.5, help="Delay between assets (seconds)")
    parser.add_argument("--db", default="crawler_hybrid.db", help="Database path")

    args = parser.parse_args()

    crawler = HybridCrawler(
        domain=args.domain,
        output_dir=args.output,
        html_delay=args.html_delay,
        asset_delay=args.asset_delay,
        db_path=args.db,
    )

    crawler.run(args.from_date, args.to_date)


if __name__ == "__main__":
    main()
