"""
Content Scout - Python Scraping Service
Pinterest, Google Images, DuckDuckGo scraping with multiple fallback engines.
Runs as a local FastAPI server on port 8899.
"""

import asyncio
import base64
import json
import re
from typing import Optional
from urllib.parse import quote

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Content Scout Scraper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared httpx client with browser-like headers
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


# ── Models ──────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    sources: list[str] = ["duckduckgo", "pinterest", "google"]
    industry: str = ""
    page: int = 0  # pagination: 0 = first page, 1 = second, etc.

class ProxyRequest(BaseModel):
    url: str


# ── Helpers ─────────────────────────────────────────

def is_single_design(width: int, height: int) -> bool:
    """Filter out grid/collage images - only keep single design images."""
    if width <= 0 or height <= 0:
        return True  # Unknown dimensions, keep it
    ratio = width / height
    # Reject extremely wide (panorama/grid) or extremely tall (vertical grid) images
    # Typical single designs: 0.4 (9:16 story) to 2.0 (16:9 banner)
    if ratio < 0.35 or ratio > 2.2:
        return False
    # Reject very large images that are likely multi-image grids
    # A grid of 4 images might be 2000x2000, but a single image could be too
    # Better heuristic: if both dimensions are very large AND ratio is near 1:1, could be grid
    # But we can't be sure, so keep it
    return True


def filter_quality(results: list[dict]) -> list[dict]:
    """Filter results for quality single-design images."""
    filtered = []
    for r in results:
        w = r.get("width", 0)
        h = r.get("height", 0)
        url = r.get("imageUrl", "")

        # Skip tiny images
        if w > 0 and h > 0 and (w < 300 or h < 300):
            continue

        # Skip grid/collage images
        if not is_single_design(w, h):
            continue

        # Skip known bad domains
        if any(d in url for d in ["gstatic.com", "google.com/images", "favicon", "logo", "icon", "badge"]):
            continue

        filtered.append(r)
    return filtered


# ── Scrapers ────────────────────────────────────────

def search_duckduckgo(query: str, page: int = 0) -> list[dict]:
    """DuckDuckGo image search using duckduckgo_search library."""
    results = []
    try:
        from duckduckgo_search import DDGS
        max_results = 50  # Fetch more
        with DDGS() as ddgs:
            for r in ddgs.images(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "imageUrl": r.get("image", ""),
                    "thumbnailUrl": r.get("thumbnail", r.get("image", "")),
                    "sourceUrl": r.get("url", ""),
                    "platform": "duckduckgo",
                    "width": r.get("width", 0),
                    "height": r.get("height", 0),
                })
    except Exception as e:
        print(f"DDG error: {e}")
    return results


def search_pinterest(query: str, page: int = 0) -> list[dict]:
    """Pinterest scraping via their resource endpoint."""
    results = []
    try:
        # Use Pinterest's internal search API
        url = "https://www.pinterest.com/resource/BaseSearchResource/get/"

        # Bookmark for pagination
        bookmark = None
        pages_to_fetch = page + 1  # Fetch up to requested page

        for p in range(pages_to_fetch):
            options = {
                "query": query,
                "scope": "pins",
                "page_size": 50,
            }
            if bookmark:
                options["bookmarks"] = [bookmark]

            params = {
                "source_url": f"/search/pins/?q={quote(query)}",
                "data": json.dumps({
                    "options": options,
                    "context": {},
                }),
            }
            with httpx.Client(headers={**HEADERS, "X-Requested-With": "XMLHttpRequest"}, follow_redirects=True, timeout=15) as client:
                resp = client.get(url, params=params)

            if resp.status_code != 200:
                break

            data = resp.json()
            resource = data.get("resource_response", {})
            pins = resource.get("data", {}).get("results", [])
            bookmark = resource.get("bookmark")

            if p < pages_to_fetch - 1:
                continue  # Skip earlier pages, we only want the requested page

            for pin in pins:
                images = pin.get("images", {})
                orig = images.get("orig", {})
                thumb = images.get("236x", {})
                if orig.get("url"):
                    results.append({
                        "title": pin.get("grid_title", "") or pin.get("description", "")[:80] or f"Pinterest {len(results)+1}",
                        "imageUrl": orig["url"],
                        "thumbnailUrl": thumb.get("url", orig["url"]),
                        "sourceUrl": f"https://www.pinterest.com/pin/{pin.get('id', '')}",
                        "platform": "pinterest",
                        "width": orig.get("width", 0),
                        "height": orig.get("height", 0),
                    })

            if not bookmark:
                break

        # Fallback: HTML scraping
        if not results:
            with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=15) as client:
                resp = client.get(f"https://www.pinterest.com/search/pins/?q={quote(query)}")
            html = resp.text
            seen = set()
            for match in re.finditer(r'https://i\.pinimg\.com/(?:originals|736x)/[a-f0-9/]+\.\w+', html):
                img_url = match.group(0)
                if img_url in seen or len(results) >= 30:
                    continue
                seen.add(img_url)
                orig_url = img_url.replace("/736x/", "/originals/")
                thumb_url = img_url if "/736x/" in img_url else img_url.replace("/originals/", "/236x/")
                results.append({
                    "title": f"Pinterest {len(results)+1}",
                    "imageUrl": orig_url,
                    "thumbnailUrl": thumb_url,
                    "sourceUrl": "https://www.pinterest.com",
                    "platform": "pinterest",
                    "width": 0,
                    "height": 0,
                })
    except Exception as e:
        print(f"Pinterest error: {e}")
    return results


def search_google_images(query: str, page: int = 0) -> list[dict]:
    """Google Images scraping with pagination."""
    results = []
    try:
        # Google uses ijn parameter for pagination (0, 1, 2, ...)
        url = f"https://www.google.com/search?q={quote(query)}&tbm=isch&ijn={page}"
        with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=15) as client:
            resp = client.get(url)
        html = resp.text

        seen = set()
        # Google embeds full-res image URLs in JS
        pattern = re.compile(
            r'\["(https?://[^"]+\.(?:jpg|jpeg|png|webp))",\s*(\d+),\s*(\d+)\]'
        )
        for match in pattern.finditer(html):
            if len(results) >= 40:
                break
            img_url = match.group(1)
            height = int(match.group(2))
            width = int(match.group(3))
            if img_url in seen or "gstatic.com" in img_url or "google.com" in img_url:
                continue
            seen.add(img_url)
            results.append({
                "title": f"Google Image {len(results)+1}",
                "imageUrl": img_url,
                "thumbnailUrl": img_url,
                "sourceUrl": img_url,
                "platform": "google",
                "width": width,
                "height": height,
            })
    except Exception as e:
        print(f"Google Images error: {e}")
    return results


def proxy_image(image_url: str) -> dict:
    """Download an image and return as base64."""
    with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=30) as client:
        resp = client.get(image_url)
    resp.raise_for_status()

    b64 = base64.b64encode(resp.content).decode()

    content_type = resp.headers.get("content-type", "")
    if "png" in content_type:
        mime = "image/png"
    elif "webp" in content_type:
        mime = "image/webp"
    elif "gif" in content_type:
        mime = "image/gif"
    else:
        mime = "image/jpeg"

    return {"base64": b64, "mimeType": mime}


# ── API Endpoints ───────────────────────────────────

@app.post("/search")
def api_search(req: SearchRequest):
    query = f"{req.industry} {req.query}".strip() if req.industry else req.query
    all_results = []
    sources_report = {}

    for source in req.sources:
        try:
            if source == "duckduckgo":
                r = search_duckduckgo(f"{query} social media post design", req.page)
            elif source == "pinterest":
                r = search_pinterest(query, req.page)
            elif source == "google":
                r = search_google_images(f"{query} social media design inspiration", req.page)
            else:
                continue
            sources_report[source] = len(r)
            all_results.extend(r)
        except Exception as e:
            print(f"Source {source} failed: {e}")
            sources_report[source] = 0

    # Deduplicate by imageUrl
    seen = set()
    unique = []
    for item in all_results:
        if item["imageUrl"] not in seen:
            seen.add(item["imageUrl"])
            unique.append(item)

    # Filter quality: remove grid/collage images, tiny images
    filtered = filter_quality(unique)

    return {
        "results": filtered,
        "total": len(filtered),
        "total_raw": len(unique),
        "sources_report": sources_report,
        "page": req.page,
        "has_more": len(filtered) > 0,
    }


@app.post("/proxy")
def api_proxy(req: ProxyRequest):
    return proxy_image(req.url)


@app.get("/health")
def api_health():
    return {
        "status": "ok",
        "engine": "duckduckgo_search + httpx",
        "sources": ["duckduckgo", "pinterest", "google"],
    }


if __name__ == "__main__":
    import uvicorn
    print("🔍 Content Scout Scraper starting on http://localhost:8899")
    uvicorn.run(app, host="0.0.0.0", port=8899)
