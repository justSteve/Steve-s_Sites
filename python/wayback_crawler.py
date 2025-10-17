#!/usr/bin/env python3
"""
Wayback Machine Crawler for JustSteve.com Archive
Slowly and politely crawls the archived site, respecting off-peak hours.
"""

import json
import sqlite3
import time
import requests
from datetime import datetime, time as dt_time
from urllib.parse import urljoin, urlparse
from pathlib import Path
from bs4 import BeautifulSoup
import logging
from typing import Set, Optional

# Configuration
DOMAINS_CONFIG = "domains.json"
SNAPSHOT_LIST = None  # Optional: path to snapshot selection file
OUTPUT_DIR = Path("archived_pages")
DB_FILE = "crawler_state.db"
LOG_FILE = "crawler.log"

# Scheduling configuration
OFF_PEAK_START = dt_time(22, 0)  # 10 PM
OFF_PEAK_END = dt_time(6, 0)     # 6 AM
MIN_DELAY_SECONDS = 30           # Minimum delay between requests
MAX_DELAY_SECONDS = 120          # Maximum delay between requests

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class CrawlerDB:
    """Manages persistent state for the crawler."""

    def __init__(self, db_path: str = DB_FILE):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.init_db()

    def init_db(self):
        """Initialize the database schema."""
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS urls (
                url TEXT,
                timestamp TEXT,
                domain TEXT,
                status TEXT NOT NULL,
                local_path TEXT,
                discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fetched_at TIMESTAMP,
                error TEXT,
                PRIMARY KEY (url, timestamp)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS crawler_state (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        self.conn.commit()

    def add_url(self, url: str, timestamp: str, domain: str, status: str = 'pending'):
        """Add a URL to the queue if it doesn't exist."""
        cursor = self.conn.cursor()
        cursor.execute(
            "INSERT OR IGNORE INTO urls (url, timestamp, domain, status) VALUES (?, ?, ?, ?)",
            (url, timestamp, domain, status)
        )
        self.conn.commit()

    def get_next_url(self) -> Optional[tuple]:
        """Get the next pending URL to crawl. Returns (url, timestamp, domain)."""
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT url, timestamp, domain FROM urls WHERE status = 'pending' LIMIT 1"
        )
        return cursor.fetchone()

    def mark_completed(self, url: str, timestamp: str, local_path: str):
        """Mark a URL as successfully fetched."""
        cursor = self.conn.cursor()
        cursor.execute(
            "UPDATE urls SET status = 'completed', local_path = ?, fetched_at = CURRENT_TIMESTAMP WHERE url = ? AND timestamp = ?",
            (local_path, url, timestamp)
        )
        self.conn.commit()

    def mark_failed(self, url: str, timestamp: str, error: str):
        """Mark a URL as failed."""
        cursor = self.conn.cursor()
        cursor.execute(
            "UPDATE urls SET status = 'failed', error = ?, fetched_at = CURRENT_TIMESTAMP WHERE url = ? AND timestamp = ?",
            (error, url, timestamp)
        )
        self.conn.commit()

    def get_stats(self) -> dict:
        """Get crawler statistics."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT
                status,
                COUNT(*) as count
            FROM urls
            GROUP BY status
        """)
        stats = {row[0]: row[1] for row in cursor.fetchall()}
        return stats

    def close(self):
        """Close the database connection."""
        self.conn.close()


class WaybackCrawler:
    """Polite crawler for Wayback Machine archives."""

    def __init__(self, snapshot_list_file: Optional[str] = None):
        self.db = CrawlerDB()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'JustSteveCrawler/1.0 (Archival Research; slow/polite crawler)'
        })
        OUTPUT_DIR.mkdir(exist_ok=True)
        self.snapshot_list_file = snapshot_list_file or SNAPSHOT_LIST

    def load_snapshot_list(self):
        """Load snapshot list from file and populate database."""
        if not self.snapshot_list_file:
            return

        path = Path(self.snapshot_list_file)
        if not path.exists():
            logger.warning(f"Snapshot list file not found: {self.snapshot_list_file}")
            return

        logger.info(f"Loading snapshot list from: {self.snapshot_list_file}")
        count = 0
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue

                parts = line.split('|')
                if len(parts) == 2:
                    timestamp, url = parts
                    # Extract domain from URL
                    parsed = urlparse(url)
                    domain = parsed.netloc.replace('www.', '')
                    self.db.add_url(url, timestamp, domain)
                    count += 1

        logger.info(f"Loaded {count} snapshots from list")

    def is_off_peak(self) -> bool:
        """Check if current time is in off-peak hours."""
        current = datetime.now().time()
        if OFF_PEAK_START > OFF_PEAK_END:
            # Spans midnight
            return current >= OFF_PEAK_START or current <= OFF_PEAK_END
        else:
            return OFF_PEAK_START <= current <= OFF_PEAK_END

    def wait_for_off_peak(self):
        """Wait until off-peak hours if not currently in them."""
        if self.is_off_peak():
            return

        now = datetime.now()
        current_time = now.time()

        # Calculate time until off-peak starts
        if current_time < OFF_PEAK_START:
            wait_until = datetime.combine(now.date(), OFF_PEAK_START)
        else:
            # Wait until tomorrow's off-peak
            from datetime import timedelta
            wait_until = datetime.combine(now.date() + timedelta(days=1), OFF_PEAK_START)

        wait_seconds = (wait_until - now).total_seconds()
        logger.info(f"Waiting until off-peak hours. Resuming at {wait_until}")
        time.sleep(wait_seconds)

    def normalize_url(self, url: str) -> str:
        """Normalize a URL to remove Wayback Machine artifacts."""
        # Remove Wayback prefix if present
        if 'web.archive.org' in url:
            parts = url.split('/http')
            if len(parts) > 1:
                url = 'http' + parts[-1]
        return url

    def is_internal_url(self, url: str, domain: str) -> bool:
        """Check if URL is internal to the specified domain."""
        normalized = self.normalize_url(url)
        parsed = urlparse(normalized)
        domain_variants = [domain, f'www.{domain}', '']
        return parsed.netloc in domain_variants

    def extract_links(self, html: str, base_url: str, domain: str) -> Set[str]:
        """Extract all internal links from HTML."""
        soup = BeautifulSoup(html, 'html.parser')
        links = set()

        for tag in soup.find_all(['a', 'link', 'img', 'script']):
            url = tag.get('href') or tag.get('src')
            if not url:
                continue

            # Make absolute
            absolute_url = urljoin(base_url, url)
            normalized = self.normalize_url(absolute_url)

            if self.is_internal_url(normalized, domain):
                links.add(normalized)

        return links

    def fetch_page(self, url: str, timestamp: str) -> Optional[str]:
        """Fetch a page from the Wayback Machine."""
        # Construct Wayback URL
        normalized = self.normalize_url(url)
        wayback_url = f"https://web.archive.org/web/{timestamp}/{normalized}"

        try:
            logger.info(f"Fetching: {wayback_url}")
            response = self.session.get(wayback_url, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.error(f"Error fetching {wayback_url}: {e}")
            return None

    def save_page(self, url: str, timestamp: str, domain: str, content: str) -> str:
        """Save page content to disk organized by domain and timestamp."""
        normalized = self.normalize_url(url)
        parsed = urlparse(normalized)

        # Create local path organized by domain/timestamp
        path = parsed.path.strip('/')
        if not path:
            path = 'index.html'
        elif not path.endswith(('.html', '.htm')):
            # Assume it's a directory
            path = f"{path}/index.html"

        local_path = OUTPUT_DIR / domain / timestamp / path
        local_path.parent.mkdir(parents=True, exist_ok=True)

        with open(local_path, 'w', encoding='utf-8') as f:
            f.write(content)

        logger.info(f"Saved to: {local_path}")
        return str(local_path)

    def crawl_one(self):
        """Crawl a single URL from the queue."""
        result = self.db.get_next_url()
        if not result:
            logger.info("No more URLs to crawl")
            return False

        url, timestamp, domain = result

        # Wait for off-peak hours
        self.wait_for_off_peak()

        # Fetch the page
        content = self.fetch_page(url, timestamp)

        if content:
            # Save the page
            local_path = self.save_page(url, timestamp, domain, content)
            self.db.mark_completed(url, timestamp, local_path)

            # Extract and queue new links (same timestamp, same domain)
            links = self.extract_links(content, url, domain)
            for link in links:
                self.db.add_url(link, timestamp, domain)

            logger.info(f"Discovered {len(links)} links")
        else:
            self.db.mark_failed(url, timestamp, "Failed to fetch")

        # Polite delay between requests
        import random
        delay = random.randint(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS)
        logger.info(f"Waiting {delay} seconds before next request")
        time.sleep(delay)

        return True

    def run(self):
        """Main crawl loop."""
        logger.info("Starting crawler...")
        logger.info(f"Off-peak hours: {OFF_PEAK_START} - {OFF_PEAK_END}")

        # Load snapshot list if provided
        self.load_snapshot_list()

        try:
            while self.crawl_one():
                # Print stats periodically
                stats = self.db.get_stats()
                logger.info(f"Stats: {stats}")
        except KeyboardInterrupt:
            logger.info("Crawler stopped by user")
        finally:
            stats = self.db.get_stats()
            logger.info(f"Final stats: {stats}")
            self.db.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Wayback Machine Archive Crawler')
    parser.add_argument('--snapshots', help='Path to snapshot selection file')
    args = parser.parse_args()

    crawler = WaybackCrawler(snapshot_list_file=args.snapshots)
    crawler.run()
