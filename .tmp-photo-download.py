import json, os, sys, urllib.parse, urllib.request, hashlib, re, time

API = "https://commons.wikimedia.org/w/api.php"
OUT = "/tmp/pixcut-photos"
os.makedirs(OUT, exist_ok=True)

def search(term, limit=10):
    params = {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f'incategory:CC-Zero filetype:bitmap {term}',
        "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": "1400",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "PixCut template photo picker (local build tooling)"})
    with urllib.request.urlopen(req, timeout=40) as r:
        data = json.load(r)
    out = []
    for p in data.get("query", {}).get("pages", {}).values():
        ii = p["imageinfo"][0]
        meta = ii.get("extmetadata", {})
        author = re.sub("<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
        out.append({
            "title": p["title"][5:],
            "thumb": ii.get("thumburl") or ii.get("url"),
            "license": meta.get("LicenseShortName", {}).get("value", ""),
            "author": author,
            "page": ii.get("descriptionurl", ""),
        })
    return out

def slug(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower())[:50].strip("-")

manifest = {}
if os.path.exists("/tmp/pixcut-photos/manifest.json"):
    manifest = json.load(open("/tmp/pixcut-photos/manifest.json"))
for term in sys.argv[1:]:
    time.sleep(4)
    try:
        items = search(term)
    except Exception as e:
        print("ERROR", term, e)
        continue
    for item in items:
        key = slug(item["title"])
        if key in manifest:
            continue
        path = os.path.join(OUT, f"{key}.jpg")
        if not os.path.exists(path):
            try:
                req = urllib.request.Request(item["thumb"], headers={"User-Agent": "PixCut template photo picker (local build tooling)"})
                with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
                    f.write(r.read())
            except Exception as e:
                print("DOWNLOAD FAILED", item["title"], e)
                continue
        item["file"] = path
        item["term"] = term
        manifest[key] = item
        print("ok", key, item["author"][:20], item["license"])

with open("/tmp/pixcut-photos/manifest.json", "w") as f:
    json.dump(manifest, f, indent=1, ensure_ascii=False)
print("total", len(manifest))
