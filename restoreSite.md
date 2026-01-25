# Site Reconstruction Plan for justSteve.com Archive

## Problem Statement

Downloaded archive has:
- 83 HTML files with **original** asset paths (e.g., `<img src="images/paper-04.jpg">`)
- Assets stored at **different** paths (e.g., `assets/external/www.juststeve.com:80/images/paper-04.jpg`)
- Opening HTML directly in browser = broken images/CSS

## Solution: Static Rewriting with Preserved Originals

Create viewable copies with rewritten URLs while keeping originals intact.

### Output Structure

```
archived_pages/juststeve.com/
├── index.html                    # NEW: Timeline browser
├── 19970601032128/
│   ├── index.html                # ORIGINAL (untouched)
│   ├── _viewable/
│   │   └── index.html            # REWRITTEN copy
│   └── assets/external/...
├── 19980127142021/
│   ├── index.html
│   ├── _viewable/
│   │   └── index.html
│   └── assets/...
└── ...
```

## Implementation

### New File: `python/site_reconstructor.py`

**Core Class:**
```python
class SiteReconstructor:
    def rewrite_html(html, timestamp) -> str
    def process_snapshot(timestamp) -> None
    def process_all_snapshots() -> None
    def generate_timeline_index() -> str
```

**URL Mapping Logic:**
| Original URL | Rewritten Path |
|--------------|----------------|
| `images/foo.jpg` | `assets/external/www.juststeve.com:80/images/foo.jpg` |
| `/images/foo.jpg` | `assets/external/www.juststeve.com:80/images/foo.jpg` |
| `http://cdn.com/x.js` | `assets/external/cdn.com/x.js` |
| `data:image/...` | unchanged |
| `#anchor` | unchanged |

**HTML Elements to Rewrite:**
- `<img src="...">`
- `<body background="...">`
- `<link href="...">`
- `<script src="...">`
- `style="background: url(...)"`

### CLI Usage

```bash
# Reconstruct all snapshots
python python/site_reconstructor.py --domain juststeve.com

# Optional: serve locally
python python/site_reconstructor.py --domain juststeve.com --serve 8000
```

## Key Files

| File | Purpose |
|------|---------|
| `python/site_reconstructor.py` | **NEW** - Main reconstruction script |
| `python/hybrid_crawler.py` | Pattern reference for BeautifulSoup, DB |
| `src/domain/assets/URLRewriter.ts` | Reference for rewriting logic |
| `crawler_hybrid.db` | Asset mapping (optional validation) |

## Verification

1. Run reconstruction: `python python/site_reconstructor.py --domain juststeve.com`
2. Open `archived_pages/juststeve.com/index.html` in browser
3. Click through timeline to verify snapshots render correctly
4. Check that images/backgrounds load from local assets
5. Verify original files remain unchanged
