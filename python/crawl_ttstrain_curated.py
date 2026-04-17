#!/usr/bin/env python3
"""
Curated crawl of ttstrain.com — ~25 snapshots selected from CDX data
to capture every distinct evolutionary phase.

Selection rationale documented in each entry.
Can be re-run safely; already-fetched pages are skipped.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from hybrid_crawler import HybridCrawler

# Curated snapshot list: (timestamp, url, rationale)
# Selected from 170+ CDX homepage snapshots by identifying size/content transitions.
CURATED_SNAPSHOTS = [
    # === Phase 1: Original CD-ROM Training Era (1998) ===
    ("19981201090815", "http://www.ttstrain.com:80/",
     "Original launch. CD-ROM nav, diamond background, logo.gif, imt_an.gif header"),

    # === Phase 2: Compliance Series Added (1999) ===
    ("19990125092426", "http://ttstrain.com:80/",
     "First content update (2586->2706 bytes). Slight changes to announcement area"),
    ("19990422055654", "http://ttstrain.com:80/",
     "BIG change (2706->3609). Compliance Series demo added, indexComptitl.gif"),
    ("19991012213510", "http://ttstrain.com:80/",
     "Mid-1999 revision (3609->3161). Content tightened"),

    # === Phase 3: Y2K / 2000-2001 Stable Era ===
    ("20000305203019", "http://ttstrain.com:80/",
     "Y2K update (3161->2907). Copyright 2000, demo link added"),
    ("20010301182549", "http://www.ttstrain.com:80/",
     "Early 2001 (2942). Stable but minor nav tweaks"),
    ("20010923033608", "http://ttstrain.com:80/",
     "Late 2001 (3071). Content grew — new products?"),

    # === Phase 4: Major Redesign — Web Training Era (2002) ===
    ("20020402121459", "http://www.ttstrain.com:80/",
     "MAJOR REDESIGN (2517). Blue/gray scheme, external CSS, JS menus, ASP backend. "
     "New logos: logo_an.gif, tts.gif, name.gif, slogan.gif. Waunakee address."),
    ("20020925195409", "http://ttstrain.com:80/",
     "Settled redesign (2558). Minor content adjustments"),

    # === Phase 5: Stable ASP Era (2003-2005) ===
    ("20030531165659", "http://ttstrain.com:80/",
     "Mid-2003 (2612). Webinar emphasis growing"),
    ("20031028022412", "http://ttstrain.com:80/",
     "Oct 2003 SPIKE (3548). Significantly more content — product launch?"),
    ("20031216160134", "http://www.ttstrain.com:80/",
     "Dec 2003 (2626). Back to normal size — spike was temporary promo?"),
    ("20040607154304", "http://www.ttstrain.com:80/",
     "Mid-2004 (2630). Stable period representative"),
    ("20050208012815", "http://www.ttstrain.com:80/",
     "Early 2005 (2629). Still stable"),

    # === Phase 6: Another Refresh (late 2005-2007) ===
    ("20051109230924", "http://www.ttstrain.com:80/",
     "Nov 2005 JUMP (3584). New version — Flash rotating logo era begins. "
     "tts_logo_rotate.swf referenced in 2004+ pages"),
    ("20060621213634", "http://www.ttstrain.com:80/",
     "Mid-2006 (3584). Stable in this phase"),
    ("20070509133814", "http://www.ttstrain.com:80/",
     "Early 2007 (3589). Last good version before collapse"),
    ("20070614182828", "http://www.ttstrain.com:80/",
     "BROKEN (543 bytes). Site broke mid-2007 — minimal content"),

    # === Phase 7: Redirect Era (2007-2010) — skip, just 302s ===
    # === Phase 8: Brief Return (2011) ===
    ("20110110021729", "http://www.ttstrain.com:80/",
     "Brief return (1093). Minimal page — transitional?"),

    # === Phase 9: WordPress Era (2013-2015) ===
    ("20130204083919", "http://www.ttstrain.com:80/",
     "WordPress launch (3760). New CMS, ttslogo.png, modern layout"),
    ("20130720021736", "http://ttstrain.com/",
     "WordPress mature (3961). Content filled in"),
    ("20150315000645", "http://www.ttstrain.com:80/",
     "2015 (3805). WordPress stable era"),

    # === Phase 10: Major WordPress Redesign (2016-2020) ===
    ("20160516025438", "http://ttstrain.com:80/",
     "HUGE redesign (12671 bytes!). Much more content, new theme"),
    ("20161005155657", "http://ttstrain.com/",
     "Stable v2 (13600). Mature version of 2016 redesign"),
    ("20171002182600", "https://ttstrain.com/",
     "HTTPS transition (12092). SSL era begins"),
    ("20190825060814", "https://ttstrain.com/",
     "Late era (13414). Final active content period"),
    ("20200403152151", "https://ttstrain.com/",
     "Last real content (13242). COVID era — last capture before domain dies"),
]


def main():
    print(f"Curated ttstrain.com crawl: {len(CURATED_SNAPSHOTS)} snapshots selected")
    print(f"(from 170+ available in Wayback Machine)\n")

    crawler = HybridCrawler(
        domain="ttstrain.com",
        output_dir="archived_pages",
        html_delay=2.0,      # 2s between pages
        asset_delay=0.5,      # 0.5s between assets
        db_path="crawler_hybrid.db",
    )

    # Save selection rationale
    import json
    rationale_path = crawler.output_dir / "ttstrain.com" / "curated_selection.json"
    rationale_path.parent.mkdir(parents=True, exist_ok=True)
    rationale_path.write_text(json.dumps({
        "domain": "ttstrain.com",
        "totalAvailableSnapshots": 170,
        "selectedSnapshots": len(CURATED_SNAPSHOTS),
        "selectionMethod": "Manual CDX size-change analysis",
        "snapshots": [
            {"timestamp": ts, "url": url, "rationale": rationale}
            for ts, url, rationale in CURATED_SNAPSHOTS
        ]
    }, indent=2))
    print(f"Selection rationale saved to {rationale_path}\n")

    # Process each snapshot
    for i, (timestamp, url, rationale) in enumerate(CURATED_SNAPSHOTS):
        print(f"\n{'='*60}")
        print(f"[{i+1}/{len(CURATED_SNAPSHOTS)}] {timestamp}")
        print(f"  Rationale: {rationale}")
        print(f"{'='*60}")

        try:
            crawler.process_snapshot(timestamp, url)
        except KeyboardInterrupt:
            print("\n\nInterrupted — progress saved in crawler_hybrid.db")
            print("Re-run this script to resume from where you left off.")
            break
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()

    # Summary
    print(f"\n{'='*60}")
    print("CRAWL SUMMARY")
    print(f"{'='*60}")
    print(f"HTML: {crawler.stats['html_fetched']} fetched, {crawler.stats['html_failed']} failed")
    print(f"Assets: {crawler.stats['assets_fetched']} fetched, "
          f"{crawler.stats['assets_cached']} cached, "
          f"{crawler.stats['assets_failed']} failed")
    print(f"\nAll progress tracked in crawler_hybrid.db")
    print(f"Re-run safely to retry failures or add more snapshots later.")


if __name__ == "__main__":
    main()
