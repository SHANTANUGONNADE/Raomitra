import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"C:\xampp\htdocs\Roamitrawebsite")
JS_PATH = ROOT / "public" / "assets" / "js" / "india-cities.js"
CACHE_PATH = ROOT / "scripts" / "destination-image-cache.json"
UA = "RoamitraWebsite/1.0 (https://localhost; destination photo lookup)"

CITY_IMAGES = {
    "newdelhi": "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&h=520&fit=crop",
    "mumbai": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&h=520&fit=crop",
    "bengaluru": "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&h=520&fit=crop",
    "chennai": "https://images.unsplash.com/photo-1582510003544-4d00b8f6daa6?w=800&h=520&fit=crop",
    "hyderabad": "https://images.unsplash.com/photo-1551161242-b5af797b7233?w=800&h=520&fit=crop",
    "kolkata": "https://images.unsplash.com/photo-1558431382-27e303142255?w=800&h=520&fit=crop",
    "jaipur": "https://images.unsplash.com/photo-1477587458883-47145f936c5d?w=800&h=520&fit=crop",
    "agra": "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&h=520&fit=crop",
    "varanasi": "https://images.unsplash.com/photo-1561361513-2d000cb4242a?w=800&h=520&fit=crop",
    "udaipur": "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&h=520&fit=crop",
    "mysore": "https://images.unsplash.com/photo-1603262110263-fb0112e7cc33?w=800&h=520&fit=crop",
    "srinagar": "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=800&h=520&fit=crop",
    "amritsar": "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=800&h=520&fit=crop",
    "leh": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=520&fit=crop",
    "darjeeling": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&h=520&fit=crop",
    "panaji": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&h=520&fit=crop",
    "pondicherry": "https://images.unsplash.com/photo-1597073543306-0d5f5a110385?w=800&h=520&fit=crop",
    "kochi": "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&h=520&fit=crop",
    "munnar": "https://images.unsplash.com/photo-1602216056096-3b40cc0c8845?w=800&h=520&fit=crop",
    "khajuraho": "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&h=520&fit=crop",
    "mathura": "https://images.unsplash.com/photo-1617516202907-ff75846e909b?w=800&h=520&fit=crop",
}

GENERIC = {
    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&h=520&fit=crop",
}


def load_js():
    text = JS_PATH.read_text(encoding="utf-8")
    cities_json, featured_json = text.split(";\nwindow.RoamitraIndiaFeatured=", 1)
    catalog = json.loads(cities_json.split("=", 1)[1])
    featured = json.loads(featured_json.rstrip(";\n"))
    return catalog, featured


def save_js(catalog, featured):
    js = "window.RoamitraIndiaCities=" + json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ";\n"
    js += "window.RoamitraIndiaFeatured=" + json.dumps(featured, separators=(",", ":")) + ";\n"
    JS_PATH.write_text(js, encoding="utf-8")


def http_json(url):
    delay = 1.2
    for attempt in range(6):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=22) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 503) and attempt < 5:
                time.sleep(delay)
                delay = min(delay * 1.7, 18)
                continue
            raise
        except OSError:
            if attempt < 5:
                time.sleep(delay)
                delay = min(delay * 1.7, 18)
                continue
            raise


def wiki_thumbs(query, limit=3):
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrlimit": str(limit),
        "prop": "pageimages",
        "piprop": "thumbnail",
        "pithumbsize": "800",
        "format": "json",
        "origin": "*",
    }
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    data = http_json(url)
    out = []
    for page in ((data.get("query") or {}).get("pages") or {}).values():
        title = page.get("title") or ""
        thumb = (page.get("thumbnail") or {}).get("source")
        if thumb and "disambiguation" not in title.lower():
            out.append(thumb)
    return out


def commons_thumbs(query, limit=8):
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": "800",
        "format": "json",
        "origin": "*",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    data = http_json(url)
    out = []
    for page in ((data.get("query") or {}).get("pages") or {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        thumb = info.get("thumburl") or info.get("url")
        mime = (info.get("mime") or "")
        title = (page.get("title") or "").lower()
        if not thumb:
            continue
        if any(bad in title for bad in (".svg", ".pdf", ".djvu", "icon", "logo", "map of", "locator")):
            continue
        if mime and not mime.startswith("image/"):
            continue
        out.append(thumb)
    return out


def rest_thumb(title):
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title)
    try:
        data = http_json(url)
    except Exception:
        return []
    if data.get("type") == "disambiguation":
        return []
    thumb = (data.get("thumbnail") or {}).get("source")
    return [thumb] if thumb else []


def queries_for(item):
    title = (item.get("title") or "").strip()
    city = (item.get("planner") or "").strip()
    queries = []
    for q in (
        f"{title} {city}",
        f"{title} {city} India",
        f"{title} India",
        title,
        f"{city} India" if city else None,
    ):
        if q and q not in queries:
            queries.append(q)
    return queries


def lookup(item):
    seen = []
    for query in queries_for(item):
        buckets = []
        try:
            buckets.append(wiki_thumbs(query))
        except Exception:
            time.sleep(0.6)
        try:
            buckets.append(commons_thumbs(query))
        except Exception:
            time.sleep(0.6)
        try:
            buckets.append(rest_thumb(query))
        except Exception:
            pass
        for urls in buckets:
            for url in urls:
                if url and url not in seen:
                    seen.append(url)
        if seen:
            break
        time.sleep(0.12)
    return seen, (queries_for(item)[0] if queries_for(item) else None)


def needs_refresh(key, item, cache, reused_keys):
    entry = cache.get(key) or {}
    image = entry.get("image") or item.get("image")
    candidates = entry.get("candidates") or ([image] if image else [])
    if not image or image in GENERIC:
        return True
    if "unsplash.com" in image and key in reused_keys:
        return True
    if key in reused_keys and len(candidates) < 2:
        return True
    return False


def main():
    catalog, featured = load_js()
    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8")) if CACHE_PATH.exists() else {}

    by_image = defaultdict(list)
    for key, item in catalog.items():
        by_image[item.get("image")].append(key)
    reused_keys = {k for keys in by_image.values() if len(keys) > 1 for k in keys[1:]}

    pending = [key for key, item in catalog.items() if needs_refresh(key, item, cache, reused_keys)]
    print("catalog", len(catalog), "pending refresh", len(pending), flush=True)

    for i, key in enumerate(pending, 1):
        urls, query = lookup(catalog[key])
        old = cache.get(key) or {}
        merged = []
        for url in (old.get("candidates") or []) + ([old.get("image")] if old.get("image") else []) + urls:
            if url and url not in merged and url not in GENERIC:
                merged.append(url)
        cache[key] = {
            "image": merged[0] if merged else None,
            "query": query,
            "candidates": merged[:12],
        }
        if i % 8 == 0 or i == len(pending):
            CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
            hits = sum(1 for v in cache.values() if v.get("image"))
            print(f"{i}/{len(pending)} refreshed, cache hits {hits}", flush=True)
        time.sleep(0.18)

    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

    used = set()
    wiki_count = 0
    city_count = 0
    for key, item in catalog.items():
        entry = cache.get(key) or {}
        candidates = list(entry.get("candidates") or [])
        if entry.get("image") and entry["image"] not in candidates:
            candidates.insert(0, entry["image"])
        chosen = next((url for url in candidates if url and url not in used and url not in GENERIC), None)
        if not chosen:
            chosen = next((url for url in candidates if url and url not in GENERIC), None)
        if chosen:
            item["image"] = chosen
            used.add(chosen)
            wiki_count += 1
            continue
        city_key = re.sub(r"[^a-z0-9]+", "", (item.get("planner") or "").lower())
        fallback = CITY_IMAGES.get(city_key)
        if fallback and fallback not in used:
            item["image"] = fallback
            used.add(fallback)
        elif fallback:
            item["image"] = fallback
        else:
            item["image"] = next(iter(GENERIC))
        city_count += 1

    save_js(catalog, featured)
    images = [v["image"] for v in catalog.values()]
    print("wrote", JS_PATH)
    print("specific", wiki_count, "city_fallback", city_count)
    print("unique images", len(set(images)))


if __name__ == "__main__":
    main()
