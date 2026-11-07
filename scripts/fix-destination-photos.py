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

STOP = {
    "india", "indian", "temple", "mandir", "masjid", "mosque", "fort", "palace",
    "gate", "lake", "beach", "museum", "college", "university", "station",
    "railway", "park", "ghat", "siva", "shiva", "the", "and", "of", "in",
}

BAD_HINTS = (
    "taj_mahal", "taj-mahal", "photo-1564507592333", "photo-1524492412937",
    "india_gate", "locator", "map_of", "map of", ".svg", "flag_of", "coat_of_arms",
)

PERSON_HINTS = (
    "portrait", "photograph_of", "photograph-of", "photo_of", "headshot",
    "self-portrait", "selfportrait", "oil_on_canvas", "painting_of",
    "mugshot", "autograph", "close-up", "closeup", "passport", "bust_of",
    "profile_of", "studio_photograph", "cropped", "prime_minister",
    "narendra", "fifa", "footballer", "cricketer", "actress", "head_of",
)

METRO_HINTS = (
    "metro", "subway", "rapid_transit", "namma_metro", "delhi_metro",
    "mumbai_metro", "kolkata_metro", "hyderabad_metro", "chennai_metro",
    "rolling_stock", "emu_", "train_at", "train_on", "platform_no",
    "metro_station", "metro_train", "underground_station", "locomotive",
    "/train", "_train", "train.", "coach_",
)

PERSON_PAGE_HINTS = (
    "actor", "actress", "politician", "cricketer", "footballer", "singer",
    "poet", "writer", "author", "activist", "philosopher", "yogi", "guru",
    "artist", "painter", "model", "chef", "businessman", "businesswoman",
    "player", "composer", "director", "scientist", "scholar", "saint",
    "freedom fighter", "social reformer", "chess",
)


def tokens(text):
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    return {w for w in words if len(w) > 3 and w not in STOP}


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
    delay = 0.8
    for attempt in range(5):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=18) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 503) and attempt < 4:
                time.sleep(delay)
                delay = min(delay * 1.8, 12)
                continue
            raise
        except OSError:
            if attempt < 4:
                time.sleep(delay)
                continue
            raise


def place_allows_transit(title):
    return bool(re.search(r"railway|station|metro|train|tram|miniature railway", title or "", re.I))


def place_is_memorial(title):
    return bool(re.search(r"statue|memorial|smarak|tomb|samadhi|monument", title or "", re.I))


def page_looks_like_person(page_title, description=""):
    blob = f"{page_title or ''} {description or ''}".lower()
    if any(hint in blob for hint in PERSON_PAGE_HINTS):
        return True
    if re.search(r"\b(born|died)\b", blob):
        return True
    return False


def page_looks_like_metro(page_title, dest_title):
    page = (page_title or "").lower()
    dest = (dest_title or "").lower()
    if place_allows_transit(dest):
        return False
    return bool(re.search(r"metro station|metro line|railway station|subway|rapid transit", page))


def relevant(dest_title, city, page_title, description=""):
    page = (page_title or "").lower()
    dest = (dest_title or "").lower()
    if any(bad in page and bad not in dest for bad in ("taj mahal", "india gate", "qutub minar")):
        return False
    if page_looks_like_metro(page_title, dest_title):
        return False
    if page_looks_like_person(page_title, description) and not place_is_memorial(dest_title):
        return False
    dt = tokens(dest_title)
    pt = tokens(page_title)
    ct = tokens(city)
    if dt & pt:
        return True
    if ct & pt and len(dt) <= 1:
        return True
    compact_dest = re.sub(r"[^a-z0-9]+", "", dest)
    compact_page = re.sub(r"[^a-z0-9]+", "", page)
    return compact_dest and compact_dest[:8] in compact_page


def wiki_hits(query, dest_title, city):
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrlimit": "10",
        "prop": "pageimages|coordinates|description",
        "piprop": "thumbnail",
        "pithumbsize": "800",
        "format": "json",
    }
    data = http_json("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params))
    geo = []
    other = []
    for page in ((data.get("query") or {}).get("pages") or {}).values():
        title = page.get("title") or ""
        thumb = (page.get("thumbnail") or {}).get("source")
        desc = page.get("description") or ""
        if not thumb:
            continue
        width = (page.get("thumbnail") or {}).get("width") or 0
        height = (page.get("thumbnail") or {}).get("height") or 0
        if is_bad_image(thumb, dest_title, title, width, height):
            continue
        if not relevant(dest_title, city, title, desc):
            continue
        if len(tokens(dest_title)) <= 1 and not page.get("coordinates"):
            continue
        (geo if page.get("coordinates") else other).append(thumb)
    return geo + other


def commons_hits(query, dest_title, city):
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",
        "gsrlimit": "12",
        "prop": "imageinfo",
        "iiprop": "url|mime|size",
        "iiurlwidth": "800",
        "format": "json",
    }
    data = http_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params))
    out = []
    for page in ((data.get("query") or {}).get("pages") or {}).values():
        title = page.get("title") or ""
        info = (page.get("imageinfo") or [{}])[0]
        thumb = info.get("thumburl") or info.get("url")
        mime = info.get("mime") or ""
        low = title.lower()
        if not thumb:
            continue
        if mime and not str(mime).startswith("image/"):
            continue
        if any(bad in low for bad in (".svg", ".pdf", "icon", "logo", "locator", "map of", "flag of")):
            continue
        if is_bad_image(thumb, dest_title, title, info.get("width") or 0, info.get("height") or 0):
            continue
        if relevant(dest_title, city, title) or tokens(dest_title) & tokens(title):
            out.append(thumb)
    return out


def place_queries(item):
    title = item.get("title") or ""
    city = item.get("planner") or ""
    queries = []
    extras = []
    low = title.lower()
    if place_is_memorial(title):
        extras.append(f"{title} {city} statue monument exterior")
    elif re.search(r"park|garden|lake|beach|fort|palace|temple|museum|library|ashram|university|college|gate", low):
        extras.append(f"{title} {city} building exterior")
    else:
        extras.append(f"{title} {city} India landscape")
        extras.append(f"{title} {city} village town")
    for q in (
        f'"{title}" {city} India',
        f"{title} {city} India",
        *extras,
        f"{title} {city}",
        title,
    ):
        if q and q not in queries:
            queries.append(q)
    return queries


def lookup(item):
    title = item.get("title") or ""
    city = item.get("planner") or ""
    seen = []
    for query in place_queries(item):
        try:
            for url in wiki_hits(query, title, city) + commons_hits(query, title, city):
                if url and url not in seen:
                    seen.append(url)
        except Exception:
            time.sleep(0.4)
        if seen:
            break
        time.sleep(0.08)
    return seen


def norm_title(title, city):
    t = re.sub(r"[^a-z0-9]+", "", (title or "").lower())
    t = t.rstrip("s")
    c = re.sub(r"[^a-z0-9]+", "", (city or "").lower())
    return t + "|" + c


def drop_duplicate_places(catalog, featured):
    groups = defaultdict(list)
    for key, item in catalog.items():
        groups[norm_title(item.get("title"), item.get("planner"))].append(key)
    drop = set()
    for keys in groups.values():
        if len(keys) < 2:
            continue
        keys.sort(key=lambda k: (-len(catalog[k].get("title") or ""), k))
        keep = keys[0]
        for key in keys[1:]:
            drop.add(key)
        # Prefer Eden Gardens spelling
        if any("eden garden" in (catalog[k].get("title") or "").lower() for k in keys):
            preferred = next((k for k in keys if (catalog[k].get("title") or "").lower() == "eden gardens"), keep)
            drop.update(k for k in keys if k != preferred)
    for key in drop:
        catalog.pop(key, None)
    featured[:] = [k for k in featured if k in catalog]
    return drop


def is_bad_image(url, title, page_title="", width=0, height=0, allow_unsplash=False):
    low = f"{url or ''} {page_title or ''}".lower()
    dest = (title or "").lower()
    if not url:
        return True
    if any(hint in low for hint in BAD_HINTS) and "taj" not in dest:
        return True
    if any(hint in low for hint in PERSON_HINTS):
        return True
    if any(hint in low for hint in METRO_HINTS) and not place_allows_transit(title):
        return True
    if place_is_memorial(title) and not re.search(r"statue|memorial|smarak|monument|sculpt|tomb", low):
        return True
    if height and width and height > width * 1.12:
        if not place_is_memorial(title) and not re.search(r"tower|minar|lighthouse", dest):
            return True
    if "unsplash.com" in low and not allow_unsplash:
        return True
    return False


def main():
    catalog, featured = load_js()
    dropped = drop_duplicate_places(catalog, featured)
    print("dropped duplicates", len(dropped), sorted(dropped)[:12], flush=True)

    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8")) if CACHE_PATH.exists() else {}

    def assign_unique():
        used = set()
        leftover = []
        for key, item in catalog.items():
            entry = cache.get(key) or {}
            candidates = list(entry.get("candidates") or [])
            current = item.get("image")
            if current and current not in candidates and not is_bad_image(current, item.get("title")):
                candidates.insert(0, current)
            if entry.get("image") and entry["image"] not in candidates:
                candidates.append(entry["image"])
            chosen = next((url for url in candidates if url and url not in used and not is_bad_image(url, item.get("title"))), None)
            if chosen:
                item["image"] = chosen
                used.add(chosen)
            else:
                leftover.append(key)
        return leftover

    leftover = assign_unique()
    force = []
    place_type = re.compile(r"statue|memorial|smarak|library|ashram|park|gate|university|college|stadium|museum|palace|fort|wada", re.I)
    for key, item in catalog.items():
        if key in leftover:
            continue
        if is_bad_image(item.get("image"), item.get("title")):
            force.append(key)
            continue
        title = item.get("title") or ""
        img = (item.get("image") or "").lower()
        if place_type.search(title) and not re.search(
            r"statue|memorial|smarak|library|ashram|park|gate|fort|palace|temple|museum|university|college|building|exterior|monument|stadium|wada|campus",
            img,
        ):
            force.append(key)
    pending = leftover + force
    print("need network lookup", len(pending), "leftover", len(leftover), "force", len(force), flush=True)

    for i, key in enumerate(pending, 1):
        item = catalog[key]
        urls = lookup(item)
        old = cache.get(key) or {}
        merged = []
        for url in urls + (old.get("candidates") or []) + ([old.get("image")] if old.get("image") else []):
            if url and url not in merged and not is_bad_image(url, item.get("title")):
                merged.append(url)
        cache[key] = {"image": merged[0] if merged else None, "query": item.get("title"), "candidates": merged[:16]}
        if i % 10 == 0 or i == len(pending):
            CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
            print(f"{i}/{len(pending)} looked up", flush=True)
        time.sleep(0.12)

    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

    used = set()
    specific = 0
    fallback = 0
    for key, item in catalog.items():
        entry = cache.get(key) or {}
        candidates = list(entry.get("candidates") or [])
        if item.get("image") and item["image"] not in candidates and not is_bad_image(item["image"], item.get("title")):
            candidates.append(item["image"])
        chosen = next((url for url in candidates if url and url not in used and not is_bad_image(url, item.get("title"))), None)
        if chosen:
            item["image"] = chosen
            used.add(chosen)
            specific += 1
            continue
        city_key = re.sub(r"[^a-z0-9]+", "", (item.get("planner") or "").lower())
        city_img = CITY_IMAGES.get(city_key)
        if city_img:
            item["image"] = city_img
            used.add(city_img)
        elif is_bad_image(item.get("image"), item.get("title")):
            item["image"] = next(iter(CITY_IMAGES.values()))
        fallback += 1

    save_js(catalog, featured)
    print("wrote", JS_PATH)
    print("specific", specific, "fallback", fallback, "unique", len({v["image"] for v in catalog.values()}), "places", len(catalog))


if __name__ == "__main__":
    main()
