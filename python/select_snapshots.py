#!/usr/bin/env python3
"""
Snapshot Selection Tool
Helps prioritize which snapshots to download based on various criteria.
"""

import sqlite3
import argparse
from typing import List, Dict
from pathlib import Path

CDX_DB = "cdx_analysis.db"


class SnapshotSelector:
    """Select priority snapshots for downloading."""

    def __init__(self, db_path: str = CDX_DB):
        self.db_path = db_path

    def select_all_unique(self, domain: str) -> List[Dict]:
        """Select all unique content versions (default strategy)."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, url, digest, length, change_score
            FROM snapshots
            WHERE domain = ? AND is_unique_content = 1
            ORDER BY timestamp
        """, (domain,))

        results = [
            {
                'timestamp': row[0],
                'url': row[1],
                'digest': row[2],
                'length': row[3],
                'change_score': row[4]
            }
            for row in cursor.fetchall()
        ]
        conn.close()
        return results

    def select_significant_only(self, domain: str, threshold: float = 50.0) -> List[Dict]:
        """Select only snapshots with significant changes."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, url, digest, length, change_score
            FROM snapshots
            WHERE domain = ? AND change_score >= ?
            ORDER BY timestamp
        """, (domain, threshold))

        results = [
            {
                'timestamp': row[0],
                'url': row[1],
                'digest': row[2],
                'length': row[3],
                'change_score': row[4]
            }
            for row in cursor.fetchall()
        ]
        conn.close()
        return results

    def select_one_per_year(self, domain: str) -> List[Dict]:
        """Select one representative snapshot per year (highest change score)."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, url, digest, length, change_score, year
            FROM snapshots
            WHERE domain = ?
            GROUP BY year
            HAVING change_score = MAX(change_score)
            ORDER BY year
        """, (domain,))

        results = [
            {
                'timestamp': row[0],
                'url': row[1],
                'digest': row[2],
                'length': row[3],
                'change_score': row[4],
                'year': row[5]
            }
            for row in cursor.fetchall()
        ]
        conn.close()
        return results

    def select_top_n(self, domain: str, n: int = 10) -> List[Dict]:
        """Select top N most significant snapshots."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, url, digest, length, change_score
            FROM snapshots
            WHERE domain = ?
            ORDER BY change_score DESC, timestamp ASC
            LIMIT ?
        """, (domain, n))

        results = [
            {
                'timestamp': row[0],
                'url': row[1],
                'digest': row[2],
                'length': row[3],
                'change_score': row[4]
            }
            for row in cursor.fetchall()
        ]
        conn.close()
        return results

    def select_by_years(self, domain: str, years: List[int]) -> List[Dict]:
        """Select all snapshots from specific years."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        placeholders = ','.join('?' * len(years))
        cursor.execute(f"""
            SELECT timestamp, url, digest, length, change_score, year
            FROM snapshots
            WHERE domain = ? AND year IN ({placeholders})
            ORDER BY timestamp
        """, [domain] + years)

        results = [
            {
                'timestamp': row[0],
                'url': row[1],
                'digest': row[2],
                'length': row[3],
                'change_score': row[4],
                'year': row[5]
            }
            for row in cursor.fetchall()
        ]
        conn.close()
        return results

    def select_date_range(self, domain: str, start: str, end: str) -> List[Dict]:
        """Select snapshots within a date range (YYYYMMDD format)."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, url, digest, length, change_score
            FROM snapshots
            WHERE domain = ? AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp
        """, (domain, start, end))

        results = [
            {
                'timestamp': row[0],
                'url': row[1],
                'digest': row[2],
                'length': row[3],
                'change_score': row[4]
            }
            for row in cursor.fetchall()
        ]
        conn.close()
        return results

    def export_selection(self, snapshots: List[Dict], output_file: str):
        """Export selected snapshots to a file for use by crawler."""
        with open(output_file, 'w') as f:
            f.write("# Selected snapshots for download\n")
            f.write("# Format: timestamp|url\n")
            f.write(f"# Total: {len(snapshots)}\n\n")

            for snap in snapshots:
                f.write(f"{snap['timestamp']}|{snap['url']}\n")

        print(f"Exported {len(snapshots)} snapshots to: {output_file}")

    def print_selection(self, snapshots: List[Dict], title: str = "Selected Snapshots"):
        """Print selection summary."""
        print(f"\n{'='*70}")
        print(f"{title}")
        print(f"{'='*70}")
        print(f"Total: {len(snapshots)} snapshots\n")

        for i, snap in enumerate(snapshots, 1):
            timestamp = snap['timestamp']
            date = f"{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}"
            print(f"{i:3}. {date}  {snap['length']:>8,}b  ", end='')

            if snap.get('change_score'):
                print(f"score: {snap['change_score']:>6.1f}  ", end='')

            if snap.get('year'):
                print(f"year: {snap['year']}", end='')

            print()

        print(f"\n{'='*70}\n")


def main():
    parser = argparse.ArgumentParser(description='Select priority snapshots for download')
    parser.add_argument('domain', help='Domain to select snapshots from')
    parser.add_argument('--strategy', choices=[
        'all', 'significant', 'yearly', 'top', 'years', 'daterange'
    ], default='all', help='Selection strategy')
    parser.add_argument('--threshold', type=float, default=50.0,
                       help='Change score threshold for "significant" strategy')
    parser.add_argument('--top-n', type=int, default=10,
                       help='Number of snapshots for "top" strategy')
    parser.add_argument('--years', type=int, nargs='+',
                       help='Specific years for "years" strategy')
    parser.add_argument('--start', help='Start date for "daterange" strategy (YYYYMMDD)')
    parser.add_argument('--end', help='End date for "daterange" strategy (YYYYMMDD)')
    parser.add_argument('--export', help='Export selection to file')

    args = parser.parse_args()

    selector = SnapshotSelector()

    # Select based on strategy
    if args.strategy == 'all':
        snapshots = selector.select_all_unique(args.domain)
        title = f"All Unique Snapshots: {args.domain}"

    elif args.strategy == 'significant':
        snapshots = selector.select_significant_only(args.domain, args.threshold)
        title = f"Significant Snapshots (score >= {args.threshold}): {args.domain}"

    elif args.strategy == 'yearly':
        snapshots = selector.select_one_per_year(args.domain)
        title = f"One Per Year: {args.domain}"

    elif args.strategy == 'top':
        snapshots = selector.select_top_n(args.domain, args.top_n)
        title = f"Top {args.top_n} Snapshots: {args.domain}"

    elif args.strategy == 'years':
        if not args.years:
            print("Error: --years required for 'years' strategy")
            return
        snapshots = selector.select_by_years(args.domain, args.years)
        title = f"Snapshots from {args.years}: {args.domain}"

    elif args.strategy == 'daterange':
        if not args.start or not args.end:
            print("Error: --start and --end required for 'daterange' strategy")
            return
        snapshots = selector.select_date_range(args.domain, args.start, args.end)
        title = f"Snapshots {args.start} to {args.end}: {args.domain}"

    # Display results
    selector.print_selection(snapshots, title)

    # Export if requested
    if args.export:
        selector.export_selection(snapshots, args.export)


if __name__ == "__main__":
    main()
