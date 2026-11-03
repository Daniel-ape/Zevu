"""Adds product pictures to the snapshot: small WebP data URLs packed into
public/products/img-N.json (100 per file). Incremental: products that already
have a picture keep it (scripts/.image-index.json, see reuse-images.mjs); new
pictures go into new files. Stops after a time budget so a slow picture
server never makes the whole build fail.
Usage: python3 scripts/snapshot-images.py raw.json [max_new] [minutes]"""
import base64, io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

UA = "Hintaopas/0.1 (grocery price comparison app, Finland)"
raw = json.load(open(sys.argv[1]))
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 1500
budget = float(sys.argv[3]) * 60 if len(sys.argv) > 3 else 80 * 60
start = time.time()

index = json.load(open("scripts/.image-index.json")) if os.path.exists("scripts/.image-index.json") else {}
todo = [p for p in raw if p.get("image_front_small_url") and p.get("code") and str(p["code"]) not in index][:limit]
print(f"{len(index)} pictures already, {len(todo)} to fetch", flush=True)

def fetch(p):
    if time.time() - start > budget:
        return str(p["code"]), None
    try:
        req = urllib.request.Request(p["image_front_small_url"], headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            img = Image.open(io.BytesIO(r.read())).convert("RGB")
        img.thumbnail((128, 128))
        buf = io.BytesIO(); img.save(buf, "WEBP", quality=62, method=6)
        return str(p["code"]), "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return str(p["code"]), None

got = []
with ThreadPoolExecutor(8) as ex:
    for i, f in enumerate(as_completed([ex.submit(fetch, p) for p in todo])):
        code, uri = f.result()
        if uri: got.append((code, uri))
        if i % 200 == 0: print(i, len(got), int(time.time() - start), "s", flush=True)

os.makedirs("public/products", exist_ok=True)
existing = [int(f[4:-5]) for f in os.listdir("public/products") if f.startswith("img-") and f.endswith(".json")]
n = max(existing, default=-1) + 1
for k in range(0, len(got), 100):
    chunk = dict(got[k:k + 100])
    json.dump(chunk, open(f"public/products/img-{n}.json", "w"), separators=(",", ":"))
    for code in chunk: index[code] = n
    n += 1
json.dump(index, open("scripts/.image-index.json", "w"))
print(f"{len(got)} new pictures, {len(index)} in total", flush=True)
