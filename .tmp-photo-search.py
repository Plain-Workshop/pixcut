import json, urllib.parse, urllib.request, sys, os

API = "https://commons.wikimedia.org/w/api.php"

def search(term, limit=8):
    params = {
        "action": "query", "format": "json",
        "generator": "search",
        "gsrsearch": f'incategory:CC-Zero filetype:bitmap {term}',
        "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|size",
        "iiurlwidth": "1400",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "PixCut template photo picker (local build tooling)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    pages = data.get("query", {}).get("pages", {})
    out = []
    for p in pages.values():
        ii = p["imageinfo"][0]
        meta = ii.get("extmetadata", {})
        license_name = meta.get("LicenseShortName", {}).get("value", "")
        author = meta.get("Artist", {}).get("value", "")
        # strip html from author
        author = author.replace("<", " <").split("<")[0].strip()
        out.append({
            "title": p["title"],
            "thumb": ii.get("thumburl") or ii.get("url"),
            "width": ii.get("thumbwidth") or ii.get("width"),
            "height": ii.get("thumbheight") or ii.get("height"),
            "license": license_name,
            "author": author,
            "page": ii.get("descriptionurl", ""),
        })
    return out

terms = sys.argv[1:]
for term in terms:
    print(f"### {term}")
    try:
        for item in search(term):
            print(json.dumps(item, ensure_ascii=False))
    except Exception as e:
        print("ERROR", e)
