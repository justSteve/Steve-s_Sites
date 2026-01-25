#!/usr/bin/env python3
"""
Site Reconstructor for Wayback Machine Archives

Rewrites HTML files to use local asset paths, making archived pages viewable in a browser.
Preserves original files and creates viewable copies in _viewable/ subdirectories.

Usage:
    python python/site_reconstructor.py --domain juststeve.com
    python python/site_reconstructor.py --domain juststeve.com --serve 8000
"""

import argparse
import os
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup


class SiteReconstructor:
    """Rewrite archived HTML for local viewing."""

    def __init__(self, domain: str, archive_dir: str = "archived_pages"):
        self.domain = domain
        self.archive_dir = Path(archive_dir)
        self.domain_dir = self.archive_dir / domain

        # Stats
        self.stats = {
            "snapshots_processed": 0,
            "html_files_rewritten": 0,
            "urls_rewritten": 0,
        }

    def _rewrite_url(self, url: str, timestamp: str) -> str:
        """Convert original URL to local asset path."""
        if not url:
            return url

        # Preserve data URIs and anchors
        if url.startswith("data:") or url.startswith("#") or url.startswith("javascript:"):
            return url

        # Preserve mailto links
        if url.startswith("mailto:"):
            return url

        # Parse the URL
        parsed = urlparse(url)

        if parsed.scheme in ("http", "https"):
            # Absolute URL - extract hostname and path
            hostname = parsed.netloc
            path = parsed.path.lstrip("/")
            if not path:
                path = "index.html"
        else:
            # Relative URL - assume same domain with port 80
            hostname = f"www.{self.domain}:80"
            # Handle both relative and root-relative paths
            path = url.lstrip("/")
            if not path:
                return url

        # Build the local asset path
        local_path = f"assets/external/{hostname}/{path}"
        self.stats["urls_rewritten"] += 1
        return local_path

    def _rewrite_css_urls(self, css: str, timestamp: str) -> str:
        """Rewrite url() references in inline CSS."""
        def replace_url(match):
            url = match.group(1).strip("'\"")
            rewritten = self._rewrite_url(url, timestamp)
            return f"url({rewritten})"

        return re.sub(r'url\(([^)]+)\)', replace_url, css)

    def rewrite_html(self, html: str, timestamp: str) -> str:
        """Rewrite all asset URLs in HTML to point to local assets."""
        soup = BeautifulSoup(html, "html.parser")

        # Images: <img src="...">
        for img in soup.find_all("img"):
            if src := img.get("src"):
                img["src"] = self._rewrite_url(src, timestamp)

        # Background: <body background="..."> and <td background="..."> etc.
        for tag in soup.find_all(background=True):
            tag["background"] = self._rewrite_url(tag["background"], timestamp)

        # CSS links: <link href="...">
        for link in soup.find_all("link"):
            if href := link.get("href"):
                link["href"] = self._rewrite_url(href, timestamp)

        # Scripts: <script src="...">
        for script in soup.find_all("script", src=True):
            script["src"] = self._rewrite_url(script["src"], timestamp)

        # Inline styles with url()
        for tag in soup.find_all(style=True):
            if "url(" in tag["style"]:
                tag["style"] = self._rewrite_css_urls(tag["style"], timestamp)

        # Style blocks
        for style in soup.find_all("style"):
            if style.string and "url(" in style.string:
                style.string = self._rewrite_css_urls(style.string, timestamp)

        # Embed and object tags
        for embed in soup.find_all(["embed", "object"]):
            if src := embed.get("src"):
                embed["src"] = self._rewrite_url(src, timestamp)
            if data := embed.get("data"):
                embed["data"] = self._rewrite_url(data, timestamp)

        # Input images
        for inp in soup.find_all("input", type="image"):
            if src := inp.get("src"):
                inp["src"] = self._rewrite_url(src, timestamp)

        return str(soup)

    def process_snapshot(self, timestamp: str) -> int:
        """Process a single snapshot directory. Returns number of files processed."""
        snapshot_dir = self.domain_dir / timestamp
        if not snapshot_dir.exists():
            return 0

        viewable_dir = snapshot_dir / "_viewable"
        viewable_dir.mkdir(exist_ok=True)

        files_processed = 0

        # Find all HTML files in the snapshot directory (not in assets or _viewable)
        for html_file in snapshot_dir.glob("*.html"):
            if html_file.parent.name in ("_viewable", "assets"):
                continue

            try:
                html_content = html_file.read_text(encoding="utf-8", errors="replace")
                rewritten = self.rewrite_html(html_content, timestamp)

                output_path = viewable_dir / html_file.name
                output_path.write_text(rewritten, encoding="utf-8")
                files_processed += 1
                self.stats["html_files_rewritten"] += 1

            except Exception as e:
                print(f"  Error processing {html_file}: {e}")

        # Also process .htm files
        for html_file in snapshot_dir.glob("*.htm"):
            if html_file.parent.name in ("_viewable", "assets"):
                continue

            try:
                html_content = html_file.read_text(encoding="utf-8", errors="replace")
                rewritten = self.rewrite_html(html_content, timestamp)

                output_path = viewable_dir / html_file.name
                output_path.write_text(rewritten, encoding="utf-8")
                files_processed += 1
                self.stats["html_files_rewritten"] += 1

            except Exception as e:
                print(f"  Error processing {html_file}: {e}")

        return files_processed

    def process_all_snapshots(self) -> None:
        """Process all snapshot directories."""
        if not self.domain_dir.exists():
            print(f"Error: Domain directory not found: {self.domain_dir}")
            return

        # Find all timestamp directories (they start with digits)
        timestamps = sorted([
            d.name for d in self.domain_dir.iterdir()
            if d.is_dir() and d.name[0].isdigit()
        ])

        print(f"Found {len(timestamps)} snapshots to process")

        for i, timestamp in enumerate(timestamps, 1):
            files = self.process_snapshot(timestamp)
            if files > 0:
                print(f"  [{i}/{len(timestamps)}] {timestamp}: {files} files")
            self.stats["snapshots_processed"] += 1

    def generate_timeline_index(self) -> str:
        """Generate a browsable timeline index page."""
        if not self.domain_dir.exists():
            return ""

        # Find all timestamp directories
        timestamps = sorted([
            d.name for d in self.domain_dir.iterdir()
            if d.is_dir() and d.name[0].isdigit()
        ])

        # Group by year
        by_year = defaultdict(list)
        for ts in timestamps:
            year = ts[:4]
            by_year[year].append(ts)

        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{self.domain} Archive Timeline</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        h1 {{ color: #333; }}
        .summary {{ color: #666; margin-bottom: 30px; }}
        .year {{
            font-size: 1.8em;
            margin: 40px 0 15px;
            padding-bottom: 10px;
            border-bottom: 3px solid #333;
            color: #333;
        }}
        .timeline {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 15px;
        }}
        .snapshot {{
            background: white;
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 8px;
            text-decoration: none;
            color: inherit;
            transition: all 0.2s;
        }}
        .snapshot:hover {{
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }}
        .date {{ font-weight: bold; font-size: 1.1em; color: #333; }}
        .time {{ color: #666; font-size: 0.9em; margin-top: 5px; }}
        .meta {{ color: #999; font-size: 0.8em; margin-top: 8px; }}
    </style>
</head>
<body>
    <h1>{self.domain} Wayback Archive</h1>
    <p class="summary">{len(timestamps)} snapshots from {timestamps[0][:4]} to {timestamps[-1][:4]}</p>
"""

        for year in sorted(by_year.keys()):
            html += f'    <div class="year">{year}</div>\n'
            html += '    <div class="timeline">\n'

            for ts in sorted(by_year[year]):
                # Parse timestamp: YYYYMMDDHHMMSS
                date_str = f"{ts[4:6]}/{ts[6:8]}/{ts[:4]}"
                time_str = f"{ts[8:10]}:{ts[10:12]}:{ts[12:14]}" if len(ts) >= 14 else ""

                # Check if viewable version exists
                viewable_path = f"{ts}/_viewable/index.html"
                original_path = f"{ts}/index.html"

                # Prefer viewable, fall back to original
                link_path = viewable_path if (self.domain_dir / viewable_path).exists() else original_path

                html += f'''        <a href="{link_path}" class="snapshot">
            <div class="date">{date_str}</div>
            <div class="time">{time_str}</div>
            <div class="meta">Snapshot {ts}</div>
        </a>
'''
            html += '    </div>\n'

        html += """</body>
</html>"""

        return html

    def run(self) -> None:
        """Run the full reconstruction process."""
        print("=" * 60)
        print("Site Reconstructor")
        print("=" * 60)
        print(f"Domain: {self.domain}")
        print(f"Archive: {self.archive_dir}")
        print("=" * 60)

        # Process all snapshots
        print("\nRewriting HTML files...")
        self.process_all_snapshots()

        # Generate timeline index
        print("\nGenerating timeline index...")
        index_html = self.generate_timeline_index()
        if index_html:
            index_path = self.domain_dir / "index.html"
            index_path.write_text(index_html, encoding="utf-8")
            print(f"  Created: {index_path}")

        # Summary
        print("\n" + "=" * 60)
        print("RECONSTRUCTION COMPLETE")
        print("=" * 60)
        print(f"Snapshots processed: {self.stats['snapshots_processed']}")
        print(f"HTML files rewritten: {self.stats['html_files_rewritten']}")
        print(f"URLs rewritten: {self.stats['urls_rewritten']}")
        print(f"\nOpen in browser: {self.domain_dir}/index.html")
        print("=" * 60)


def serve_archive(archive_dir: str, port: int):
    """Simple HTTP server for browsing archives."""
    import http.server
    import socketserver

    os.chdir(archive_dir)

    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Serving at http://localhost:{port}")
        print(f"Open http://localhost:{port}/juststeve.com/")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")


def main():
    parser = argparse.ArgumentParser(description="Site Reconstructor for Wayback Archives")
    parser.add_argument("--domain", default="juststeve.com", help="Domain to reconstruct")
    parser.add_argument("--archive-dir", default="archived_pages", help="Archive directory")
    parser.add_argument("--serve", type=int, metavar="PORT", help="Start HTTP server on PORT")

    args = parser.parse_args()

    # Run reconstruction
    reconstructor = SiteReconstructor(args.domain, args.archive_dir)
    reconstructor.run()

    # Optionally start server
    if args.serve:
        print(f"\nStarting server on port {args.serve}...")
        serve_archive(args.archive_dir, args.serve)


if __name__ == "__main__":
    main()
