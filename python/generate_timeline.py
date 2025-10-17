#!/usr/bin/env python3
"""
Generate visual timeline reports from CDX analysis data.
Creates HTML and text-based visualizations of domain change history.
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Dict
import json

CDX_DB = "cdx_analysis.db"
OUTPUT_DIR = Path("reports")


class TimelineGenerator:
    """Generates timeline visualizations from CDX data."""

    def __init__(self, db_path: str = CDX_DB):
        self.db_path = db_path
        OUTPUT_DIR.mkdir(exist_ok=True)

    def get_domains(self) -> List[str]:
        """Get list of analyzed domains."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT domain FROM snapshots ORDER BY domain")
        domains = [row[0] for row in cursor.fetchall()]
        conn.close()
        return domains

    def get_timeline_data(self, domain: str) -> List[Dict]:
        """Get timeline data for a domain."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT timestamp, statuscode, length, change_score, digest, url
            FROM snapshots
            WHERE domain = ?
            ORDER BY timestamp
        """, (domain,))

        timeline = []
        for row in cursor.fetchall():
            date = datetime.strptime(row[0], "%Y%m%d%H%M%S")
            timeline.append({
                'timestamp': row[0],
                'date': date,
                'date_str': date.strftime('%Y-%m-%d'),
                'statuscode': row[1],
                'length': row[2],
                'change_score': row[3],
                'digest': row[4],
                'url': row[5]
            })

        conn.close()
        return timeline

    def generate_html_timeline(self, domain: str):
        """Generate HTML timeline visualization."""
        timeline = self.get_timeline_data(domain)
        if not timeline:
            return

        # Calculate year spans for visualization
        years = sorted(set(item['date'].year for item in timeline))
        year_range = years[-1] - years[0] + 1

        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Timeline: {domain}</title>
    <style>
        body {{
            font-family: 'Courier New', monospace;
            margin: 20px;
            background: #0a0a0a;
            color: #00ff00;
        }}
        h1 {{
            border-bottom: 2px solid #00ff00;
            padding-bottom: 10px;
        }}
        .summary {{
            background: #1a1a1a;
            padding: 15px;
            margin: 20px 0;
            border-left: 4px solid #00ff00;
        }}
        .timeline {{
            margin: 30px 0;
        }}
        .year-section {{
            margin: 20px 0;
            border-left: 2px solid #333;
            padding-left: 20px;
        }}
        .year-header {{
            font-size: 1.5em;
            color: #00ffff;
            margin-bottom: 10px;
        }}
        .snapshot {{
            padding: 10px;
            margin: 5px 0;
            background: #1a1a1a;
            border-left: 4px solid #666;
        }}
        .snapshot.significant {{
            border-left-color: #ff6600;
            background: #2a1a0a;
        }}
        .snapshot.major {{
            border-left-color: #ff0000;
            background: #2a0a0a;
        }}
        .date {{
            color: #888;
            font-size: 0.9em;
        }}
        .status-200 {{ color: #00ff00; }}
        .status-302 {{ color: #ffff00; }}
        .status-403, .status-404, .status-500 {{ color: #ff0000; }}
        .size {{
            color: #00aaff;
        }}
        .score {{
            color: #ff6600;
            font-weight: bold;
        }}
        .legend {{
            background: #1a1a1a;
            padding: 15px;
            margin: 20px 0;
        }}
        .legend-item {{
            display: inline-block;
            margin-right: 20px;
        }}
        .legend-box {{
            display: inline-block;
            width: 20px;
            height: 10px;
            margin-right: 5px;
        }}
    </style>
</head>
<body>
    <h1>Archive Timeline: {domain}</h1>

    <div class="summary">
        <strong>Summary:</strong><br>
        Total unique versions: {len(timeline)}<br>
        Date range: {timeline[0]['date_str']} to {timeline[-1]['date_str']}<br>
        Years covered: {year_range}<br>
    </div>

    <div class="legend">
        <div class="legend-item">
            <span class="legend-box" style="background: #666;"></span> Regular update
        </div>
        <div class="legend-item">
            <span class="legend-box" style="background: #ff6600;"></span> Significant change
        </div>
        <div class="legend-item">
            <span class="legend-box" style="background: #ff0000;"></span> Major change
        </div>
    </div>

    <div class="timeline">
"""

        # Group by year
        by_year = {}
        for item in timeline:
            year = item['date'].year
            if year not in by_year:
                by_year[year] = []
            by_year[year].append(item)

        for year in sorted(by_year.keys()):
            html += f'        <div class="year-section">\n'
            html += f'            <div class="year-header">{year}</div>\n'

            for item in by_year[year]:
                # Determine significance class
                significance = ""
                if item['change_score'] > 100:
                    significance = "major"
                elif item['change_score'] > 50:
                    significance = "significant"

                status_class = f"status-{item['statuscode']}"

                html += f'            <div class="snapshot {significance}">\n'
                html += f'                <span class="date">{item["date_str"]}</span> '
                html += f'<span class="{status_class}">[{item["statuscode"]}]</span> '
                html += f'<span class="size">{item["length"]:,}b</span>'

                if item['change_score'] > 0:
                    html += f' <span class="score">Δ{item["change_score"]:.0f}</span>'

                html += f'\n'
                html += f'                <div style="font-size: 0.8em; color: #666; margin-top: 5px;">{item["digest"][:16]}...</div>\n'
                html += f'            </div>\n'

            html += '        </div>\n'

        html += """    </div>
</body>
</html>
"""

        output_file = OUTPUT_DIR / f"timeline_{domain.replace('.', '_')}.html"
        with open(output_file, 'w') as f:
            f.write(html)

        print(f"Generated: {output_file}")

    def generate_text_report(self, domain: str):
        """Generate text-based timeline report."""
        timeline = self.get_timeline_data(domain)
        if not timeline:
            return

        output = []
        output.append("="*70)
        output.append(f"TIMELINE REPORT: {domain}")
        output.append("="*70)
        output.append("")
        output.append(f"Total versions: {len(timeline)}")
        output.append(f"Date range: {timeline[0]['date_str']} to {timeline[-1]['date_str']}")
        output.append("")
        output.append("="*70)
        output.append("")

        # Group by year
        by_year = {}
        for item in timeline:
            year = item['date'].year
            if year not in by_year:
                by_year[year] = []
            by_year[year].append(item)

        for year in sorted(by_year.keys()):
            output.append(f"\n### {year} ({len(by_year[year])} versions) ###")
            output.append("-" * 70)

            for item in by_year[year]:
                marker = " "
                if item['change_score'] > 100:
                    marker = "***"
                elif item['change_score'] > 50:
                    marker = "**"
                elif item['change_score'] > 0:
                    marker = "*"

                line = f"{marker:3} {item['date_str']} [{item['statuscode']}] {item['length']:>8,}b"
                if item['change_score'] > 0:
                    line += f"  (change: {item['change_score']:.0f})"

                output.append(line)

        output.append("")
        output.append("="*70)
        output.append("Legend: * = change, ** = significant, *** = major")
        output.append("="*70)

        output_text = "\n".join(output)
        output_file = OUTPUT_DIR / f"timeline_{domain.replace('.', '_')}.txt"
        with open(output_file, 'w') as f:
            f.write(output_text)

        print(f"Generated: {output_file}")
        return output_text

    def generate_json_export(self, domain: str):
        """Export timeline data as JSON."""
        timeline = self.get_timeline_data(domain)
        if not timeline:
            return

        # Convert datetime objects to strings for JSON serialization
        for item in timeline:
            item['date'] = item['date'].isoformat()

        output_file = OUTPUT_DIR / f"timeline_{domain.replace('.', '_')}.json"
        with open(output_file, 'w') as f:
            json.dump({
                'domain': domain,
                'total_versions': len(timeline),
                'timeline': timeline
            }, f, indent=2)

        print(f"Generated: {output_file}")

    def generate_all_reports(self):
        """Generate all report formats for all domains."""
        domains = self.get_domains()

        if not domains:
            print("No domains found in database. Run cdx_analyzer.py first.")
            return

        print(f"Generating reports for {len(domains)} domain(s)...\n")

        for domain in domains:
            print(f"\nProcessing: {domain}")
            print("-" * 50)
            self.generate_html_timeline(domain)
            self.generate_text_report(domain)
            self.generate_json_export(domain)

        print(f"\n\nAll reports saved to: {OUTPUT_DIR}/")
        print("\nOpen HTML files in a browser for interactive timeline visualization.")


if __name__ == "__main__":
    generator = TimelineGenerator()
    generator.generate_all_reports()
