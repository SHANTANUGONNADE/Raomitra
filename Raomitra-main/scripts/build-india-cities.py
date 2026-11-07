import hashlib
import json
import re
from collections import OrderedDict

import openpyxl

path = r"c:\Users\Asus\Downloads\roamitra data\data.xlsx"
wb = openpyxl.load_workbook(path, data_only=True)
rows = list(wb["Sheet1"].iter_rows(values_only=True))

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
    "leh": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=520&fit=crop",
    "darjeeling": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&h=520&fit=crop",
    "panaji": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&h=520&fit=crop",
    "pondicherry": "https://images.unsplash.com/photo-1597073543306-0d5f5a110385?w=800&h=520&fit=crop",
    "kochi": "https://images.unsplash.com/photo-1602216056096-3b40cc0c8845?w=800&h=520&fit=crop",
    "munnar": "https://images.unsplash.com/photo-1602216056096-3b40cc0c8845?w=800&h=520&fit=crop",
    "khajuraho": "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&h=520&fit=crop",
    "mathura": "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&h=520&fit=crop",
}
FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&h=520&fit=crop",
    "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&h=520&fit=crop",
    "https://images.unsplash.com/photo-1477587458883-47145f936c5d?w=800&h=520&fit=crop",
    "https://images.unsplash.com/photo-1602216056096-3b40cc0c8845?w=800&h=520&fit=crop",
    "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&h=520&fit=crop",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=520&fit=crop",
]


def slug(name):
    return re.sub(r"[^a-z0-9]+", "", (name or "").lower())


def facts_for(place, city):
    blob = (place + " " + city).lower()
    tags = [city, "India"]
    if any(w in blob for w in ["temple", "mandir", "masjid", "church", "gurudwara", "mosque"]):
        tags.append("Temples")
    elif any(w in blob for w in ["fort", "palace", "mahal", "qila", "tomb", "gate"]):
        tags.append("Heritage")
    elif any(w in blob for w in ["beach", "ghat", "lake", "hill", "sanctuary", "park"]):
        tags.append("Nature")
    elif any(w in blob for w in ["museum", "gallery", "market"]):
        tags.append("Culture")
    else:
        tags.append("Explore")
    return tags[:3]


def stable_meta(key):
    h = int(hashlib.md5(key.encode()).hexdigest()[:6], 16)
    rating = round(4.5 + (h % 5) * 0.1, 1)
    price = 850 + (h % 12) * 50
    travelers = str(120 + (h % 1800)) + " travelers"
    return rating, "₹" + str(price), travelers


places = []
for name, city in rows[1:]:
    name = str(name or "").strip()
    city = str(city or "").strip()
    if not name:
        continue
    if not city:
        city = "India"
    places.append((name, city))

by_city = OrderedDict()
for name, city in places:
    by_city.setdefault(city, []).append(name)

catalog = OrderedDict()
featured = []
used = set()

for index, (name, city) in enumerate(places, 1):
    key = slug(name)
    if not key or key in used:
        key = slug(name) + slug(city)
    if not key or key in used:
        key = (key or "place") + str(index)
    used.add(key)
    city_key = slug(city)
    img_i = int(hashlib.md5((key + city).encode()).hexdigest()[:2], 16) % len(FALLBACK_IMAGES)
    image = CITY_IMAGES.get(city_key) or FALLBACK_IMAGES[img_i]
    rating, price, travelers = stable_meta(key)
    nearby = [p for p in by_city.get(city, []) if p != name][:5]
    highlights = [name + " in " + city] + nearby[:4] + ["Plan a trip around " + city]
    catalog[key] = {
        "title": name,
        "meta": city + ", India · " + str(rating) + " rating · from " + price + " / week",
        "image": image,
        "desc": name + " is in " + city + ", India. It is one of " + str(len(by_city.get(city, []))) + " mapped places in this city on Roamitra.",
        "facts": facts_for(name, city),
        "highlights": highlights,
        "planner": city,
        "rating": str(rating),
        "travelers": travelers,
        "price": price,
        "keywords": " ".join([name, city, "india", city_key]),
    }
    featured.append(key)

out_path = r"C:\xampp\htdocs\Roamitrawebsite\public\assets\js\india-cities.js"
js = "window.RoamitraIndiaCities=" + json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ";\n"
js += "window.RoamitraIndiaFeatured=" + json.dumps(featured, separators=(",", ":")) + ";\n"
with open(out_path, "w", encoding="utf-8") as handle:
    handle.write(js)

print("rows", len(rows) - 1)
print("destinations", len(catalog))
print("featured", len(featured))
print("bytes", len(js))
