"""Downloads product pictures for the snapshot and packs them into
public/products/img-N.json (small WebP data URLs, 100 per file).
Usage: python3 scripts/snapshot-images.py raw.json [max_images]"""
import base64, io, json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

UA = "Hintaopas/0.1 (grocery price comparison app, Finland)"
raw = json.load(open(sys.argv[1]))
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 1500
todo = [p for p in raw if p.get("image_front_small_url") and p.get("code")][:limit]

def fetch(p):
    try:
        req = urllib.request.Request(p["image_front_small_url"], headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            img = Image.open(io.BytesIO(r.read())).convert("RGB")
        img.thumbnail((128, 128))
        buf = io.BytesIO(); img.save(buf, "WEBP", quality=62, method=6)
        return p["code"], "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        return p["code"], None

with ThreadPoolExecutor(6) as ex:
    got = [r for r in ex.map(fetch, todo) if r[1]]

index, chunks = {}, []
for i, (code, uri) in enumerate(got):
    if i % 100 == 0: chunks.append({})
    chunks[-1][code] = uri
    index[code] = len(chunks) - 1
import os; os.makedirs("public/products", exist_ok=True)
for n, c in enumerate(chunks):
    json.dump(c, open(f"public/products/img-{n}.json", "w"), separators=(",", ":"))
json.dump(index, open("scripts/.image-index.json", "w"))
print(f"{len(got)} of {len(todo)} pictures in {len(chunks)} files")
