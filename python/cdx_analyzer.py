#!/usr/bin/env python3
"""
CDX Analyzer for Multi-Domain Wayback Archive Project
Analyzes change history across multiple domains to identify significant snapshots.
"""

import json
import sqlite3
import requests
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Set, Optional
from collections import defaultdict
import logging

# Configuration
DOMAINS_CONFIG = "domains.json"
CDX_DB = "cdx_analysis.db"
CDX_API_BASE = "https://web.archive.org/cdx/search/cdx"
LOG_FILE = "cdx_analyzer.log"
REQUEST_DELAY = 2  # Seconds between CDX API requests

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


class CDXRecord:
    """Represents a single CDX record."""

    def __init__(self, line: str):
        parts = line.strip().split()
        if len(parts) >= 7:
            self.urlkey = parts[0]
            self.timestamp = parts[1]
            self.original = parts[2]
            self.mimetype = parts[3]
            self.statuscode = parts[4]
            self.digest = parts[5]
            self.length = int(parts[6]) if parts[6].isdigit() else 0
        else:
            raise ValueError(f"Invalid CDX line: {line}")

    @property
    def date(self) -> datetime:
        """Parse timestamp to datetime."""
        return datetime.strptime(self.timestamp, "%Y%m%d%H%M%S")

    @property
    def year(self) -> int:
        return self.date.year

    def __repr__(self):
        return f"<CDX {self.timestamp} {self.statuscode} {self.length}b>"


class CDXDatabase:
    """Manages CDX analysis results."""

    def __init__(self, db_path: str = CDX_DB):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.init_db()

    def init_db(self):
        """Initialize database schema."""
        cursor = self.conn.cursor()

        # Domains table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS domains (
                domain TEXT PRIMARY KEY,
                first_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_analyzed TIMESTAMP,
                total_snapshots INTEGER,
                unique_content_versions INTEGER,
                date_range_start TEXT,
                date_range_end TEXT,
                notes TEXT
            )
        """)

        # Snapshots table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT,
                url TEXT,
                timestamp TEXT,
                year INTEGER,
                statuscode TEXT,
                mimetype TEXT,
                digest TEXT,
                length INTEGER,
                is_unique_content BOOLEAN,
                is_significant_change BOOLEAN,
                change_score REAL,
                FOREIGN KEY (domain) REFERENCES domains(domain)
            )
        """)

        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_domain ON snapshots(domain)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON snapshots(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_digest ON snapshots(digest)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_year ON snapshots(year)")

        self.conn.commit()

    def save_snapshot(self, domain: str, record: CDXRecord,
                     is_unique: bool = False, is_significant: bool = False,
                     change_score: float = 0.0):
        """Save a snapshot record."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO snapshots
            (domain, url, timestamp, year, statuscode, mimetype, digest, length,
             is_unique_content, is_significant_change, change_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            domain, record.original, record.timestamp, record.year,
            record.statuscode, record.mimetype, record.digest, record.length,
            is_unique, is_significant, change_score
        ))
        self.conn.commit()

    def update_domain_stats(self, domain: str, stats: dict):
        """Update domain statistics."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO domains
            (domain, last_analyzed, total_snapshots, unique_content_versions,
             date_range_start, date_range_end, notes)
            VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
        """, (
            domain,
            stats.get('total_snapshots', 0),
            stats.get('unique_versions', 0),
            stats.get('first_date', ''),
            stats.get('last_date', ''),
            stats.get('notes', '')
        ))
        self.conn.commit()

    def get_domain_summary(self, domain: str) -> Optional[dict]:
        """Get summary statistics for a domain."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(DISTINCT digest) as unique_digests,
                COUNT(DISTINCT year) as years_covered,
                MIN(timestamp) as first_snapshot,
                MAX(timestamp) as last_snapshot,
                AVG(length) as avg_size,
                MAX(length) as max_size
            FROM snapshots
            WHERE domain = ?
        """, (domain,))
        row = cursor.fetchone()
        if row and row[0] > 0:
            return {
                'total_snapshots': row[0],
                'unique_versions': row[1],
                'years_covered': row[2],
                'first_snapshot': row[3],
                'last_snapshot': row[4],
                'avg_size': row[5],
                'max_size': row[6]
            }
        return None

    def get_yearly_summary(self, domain: str) -> List[dict]:
        """Get year-by-year breakdown."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT
                year,
                COUNT(*) as snapshots,
                COUNT(DISTINCT digest) as unique_versions,
                AVG(length) as avg_size,
                MAX(length) as max_size,
                GROUP_CONCAT(DISTINCT statuscode) as status_codes
            FROM snapshots
            WHERE domain = ?
            GROUP BY year
            ORDER BY year
        """, (domain,))

        results = []
        for row in cursor.fetchall():
            results.append({
                'year': row[0],
                'snapshots': row[1],
                'unique_versions': row[2],
                'avg_size': row[3],
                'max_size': row[4],
                'status_codes': row[5]
            })
        return results

    def get_significant_snapshots(self, domain: str, limit: int = None) -> List[dict]:
        """Get most significant snapshots based on change score."""
        cursor = self.conn.cursor()
        query = """
            SELECT timestamp, url, statuscode, length, change_score, digest
            FROM snapshots
            WHERE domain = ?
            ORDER BY is_significant_change DESC, change_score DESC, timestamp ASC
        """
        if limit:
            query += f" LIMIT {limit}"

        cursor.execute(query, (domain,))
        results = []
        for row in cursor.fetchall():
            results.append({
                'timestamp': row[0],
                'url': row[1],
                'statuscode': row[2],
                'length': row[3],
                'change_score': row[4],
                'digest': row[5]
            })
        return results

    def close(self):
        """Close database connection."""
        self.conn.close()


class CDXAnalyzer:
    """Analyzes CDX data for multiple domains."""

    def __init__(self):
        self.db = CDXDatabase()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'JustSteveArchiveAnalyzer/1.0 (Research; contact: user@example.com)'
        })

    def load_domains(self) -> List[dict]:
        """Load domains from configuration file."""
        try:
            with open(DOMAINS_CONFIG, 'r') as f:
                config = json.load(f)
                return config.get('domains', [])
        except FileNotFoundError:
            logger.error(f"Config file {DOMAINS_CONFIG} not found")
            return []

    def fetch_cdx_data(self, domain: str, collapse: str = "digest") -> List[CDXRecord]:
        """Fetch CDX data for a domain."""
        params = {
            'url': domain,
            'collapse': collapse,
            'output': 'text'
        }

        try:
            logger.info(f"Fetching CDX data for {domain} (collapse={collapse})")
            response = self.session.get(CDX_API_BASE, params=params, timeout=30)
            response.raise_for_status()

            records = []
            for line in response.text.strip().split('\n'):
                if line:
                    try:
                        records.append(CDXRecord(line))
                    except ValueError as e:
                        logger.warning(f"Skipping invalid CDX line: {e}")

            logger.info(f"Retrieved {len(records)} records for {domain}")
            return records

        except Exception as e:
            logger.error(f"Error fetching CDX for {domain}: {e}")
            return []

    def calculate_change_score(self, prev: CDXRecord, curr: CDXRecord) -> float:
        """
        Calculate significance score for a change.
        Higher score = more significant change.
        """
        score = 0.0

        # Size change (normalized)
        if prev.length > 0:
            size_change = abs(curr.length - prev.length) / prev.length
            score += size_change * 100

        # Status code change
        if prev.statuscode != curr.statuscode:
            score += 50

        # Mime type change
        if prev.mimetype != curr.mimetype:
            score += 30

        # Digest always different (already filtered by collapse)
        score += 10

        return score

    def analyze_domain(self, domain_config: dict):
        """Analyze a single domain."""
        domain = domain_config['name']
        logger.info(f"\n{'='*60}")
        logger.info(f"Analyzing domain: {domain}")
        logger.info(f"{'='*60}")

        # Fetch unique content versions
        records = self.fetch_cdx_data(domain, collapse="digest")

        if not records:
            logger.warning(f"No data found for {domain}")
            return

        # Analyze changes
        prev_record = None
        for i, record in enumerate(records):
            is_unique = True
            is_significant = False
            change_score = 0.0

            if prev_record:
                change_score = self.calculate_change_score(prev_record, record)
                is_significant = change_score > 50  # Threshold for significance

            self.db.save_snapshot(
                domain, record,
                is_unique=is_unique,
                is_significant=is_significant,
                change_score=change_score
            )

            prev_record = record

        # Update domain stats
        stats = {
            'total_snapshots': len(records),
            'unique_versions': len(records),
            'first_date': records[0].timestamp if records else '',
            'last_date': records[-1].timestamp if records else '',
            'notes': domain_config.get('notes', '')
        }
        self.db.update_domain_stats(domain, stats)

        # Add delay before next domain
        time.sleep(REQUEST_DELAY)

    def generate_report(self, domain: str):
        """Generate analysis report for a domain."""
        logger.info(f"\n{'='*60}")
        logger.info(f"ANALYSIS REPORT: {domain}")
        logger.info(f"{'='*60}\n")

        # Overall summary
        summary = self.db.get_domain_summary(domain)
        if summary:
            logger.info("OVERALL SUMMARY:")
            logger.info(f"  Total snapshots: {summary['total_snapshots']}")
            logger.info(f"  Unique content versions: {summary['unique_versions']}")
            logger.info(f"  Years covered: {summary['years_covered']}")
            logger.info(f"  Date range: {summary['first_snapshot']} to {summary['last_snapshot']}")
            logger.info(f"  Average size: {summary['avg_size']:.0f} bytes")
            logger.info(f"  Largest snapshot: {summary['max_size']} bytes")

        # Year-by-year breakdown
        logger.info("\nYEAR-BY-YEAR BREAKDOWN:")
        yearly = self.db.get_yearly_summary(domain)
        for year_data in yearly:
            logger.info(f"  {year_data['year']}: "
                       f"{year_data['snapshots']} snapshots, "
                       f"{year_data['unique_versions']} unique versions, "
                       f"avg size {year_data['avg_size']:.0f}b, "
                       f"status codes: {year_data['status_codes']}")

        # Most significant changes
        logger.info("\nMOST SIGNIFICANT SNAPSHOTS (Top 10):")
        significant = self.db.get_significant_snapshots(domain, limit=10)
        for snap in significant:
            date = datetime.strptime(snap['timestamp'], "%Y%m%d%H%M%S")
            logger.info(f"  {date.strftime('%Y-%m-%d')}: "
                       f"{snap['statuscode']} - {snap['length']}b "
                       f"(score: {snap['change_score']:.1f})")

    def run(self):
        """Run analysis for all configured domains."""
        domains = self.load_domains()

        if not domains:
            logger.error("No domains configured")
            return

        logger.info(f"Found {len(domains)} domain(s) to analyze")

        try:
            for domain_config in domains:
                self.analyze_domain(domain_config)

            # Generate reports
            logger.info("\n" + "="*60)
            logger.info("GENERATING REPORTS")
            logger.info("="*60)

            for domain_config in domains:
                self.generate_report(domain_config['name'])

        except KeyboardInterrupt:
            logger.info("Analysis interrupted by user")
        finally:
            self.db.close()


if __name__ == "__main__":
    analyzer = CDXAnalyzer()
    analyzer.run()
