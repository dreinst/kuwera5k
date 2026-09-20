"""Cocokkan peta rute panitia (gambar) dengan jalan OSM.

Pakai: python3 tools/trace-reference.py <gambar-peta-panitia.png>
Butuh: pillow, numpy, dan cache OSM di tools/cache/ (jalankan generate-route-map.mjs dulu).

Langkah: ambil piksel garis rute biru, lapangan hijau, dan marker KM merah dari gambar;
georeferensi ke lon/lat lewat titik kontrol (ujung kiri/kanan/bawah rute dan pusat lapangan);
lalu hitung ruas OSM mana yang tertutup garis biru. Hasil: daftar ruas + overlay /tmp/ref-overlay.png.
"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
img_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not img_path or not img_path.exists():
    sys.exit("beri path gambar peta panitia")

# Titik kontrol nyata (dari hasil perutean OSM sebelumnya).
LON_LEFT = 112.6384    # Jl. Panglima Besar Sudirman (ujung barat rute)
LON_RIGHT = 112.6488   # simpang Indraprasta / Hamid Rusdi Timur (ujung timur rute)
LAT_BOTTOM = -7.9810   # simpang Untung Suropati Utara / Kesatrian (ujung selatan rute)

im = Image.open(img_path).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(float) / 255
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx, mn = a.max(-1), a.min(-1)
v = mx
s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
d = np.maximum(mx - mn, 1e-6)
h = (np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60)

blue = (h > 195) & (h < 222) & (s > 0.45) & (v > 0.55)
green = (h > 90) & (h < 150) & (s > 0.35) & (v > 0.3)
red = ((h < 15) | (h > 345)) & (s > 0.5) & (v > 0.25) & (v < 0.7)
map_area = np.zeros_like(blue); map_area[: int(H * 0.8)] = True  # buang legenda di bawah
blue &= map_area; green &= map_area; red &= map_area

ys, xs = np.nonzero(blue)
if len(xs) < 1000:
    sys.exit(f"garis biru terlalu sedikit ({len(xs)} px), cek ambang warna")
x_left, x_right, y_top, y_bottom = xs.min(), xs.max(), ys.min(), ys.max()
gy, gx = np.nonzero(green)
gcx, gcy = gx.mean(), gy.mean()
print(f"gambar {W}x{H}; biru {len(xs)} px, bbox x {x_left}-{x_right} y {y_top}-{y_bottom}; hijau centroid {gcx:.0f},{gcy:.0f}")

# Poligon Lapangan Rampal dari OSM (terbesar bernama Rampal).
elements = []
for f in ["roads.json", "rampal-roads.json", "route-streets.json"]:
    p = HERE / "cache" / f
    if p.exists():
        elements += json.loads(p.read_text())["elements"]
seen, ways = set(), []
for e in elements:
    if e.get("type") == "way" and e.get("geometry") and e["id"] not in seen:
        seen.add(e["id"]); ways.append(e)
parks = [w for w in ways if "Rampal" in (w["tags"].get("name") or "") and w["tags"].get("leisure")]
def bbox_area(gm):
    la = [p["lat"] for p in gm]; lo = [p["lon"] for p in gm]
    return (max(la) - min(la)) * (max(lo) - min(lo))
park = max(parks, key=lambda w: bbox_area(w["geometry"]))
plat = sum(p["lat"] for p in park["geometry"]) / len(park["geometry"])
plon = sum(p["lon"] for p in park["geometry"]) / len(park["geometry"])

# Georeferensi: x = ax*lon + bx ; y = ay*lat + by
ax = (x_right - x_left) / (LON_RIGHT - LON_LEFT); bx = x_left - ax * LON_LEFT
ay = (y_bottom - gcy) / (LAT_BOTTOM - plat); by = gcy - ay * plat
iso = abs(ay) / (ax / math.cos(math.radians(plat)))
print(f"skala: {ax:.0f} px/deg lon, {ay:.0f} px/deg lat, rasio isotropi {iso:.3f} (ideal ~1.0)")
if abs(iso - 1) > 0.08:
    print("  rasio jauh dari 1, pakai asumsi utara-atas: skala lat dari skala lon")
    ay = -ax / math.cos(math.radians(plat)); by = gcy - ay * plat
to_px = lambda lat, lon: (ax * lon + bx, ay * lat + by)
print(f"prediksi lat ujung atas rute: {(y_top - by) / ay:.4f}")

# Cakupan tiap ruas OSM oleh garis biru.
R = 6371000.0
def hav(p, q):
    dlat = math.radians(q["lat"] - p["lat"]); dlon = math.radians(q["lon"] - p["lon"])
    x = math.sin(dlat / 2) ** 2 + math.cos(math.radians(p["lat"])) * math.cos(math.radians(q["lat"])) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))

def dilate(mask, rad):
    out = mask.copy()
    for dy in range(-rad, rad + 1, 2):
        for dx in range(-rad, rad + 1, 2):
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out
blue_wide = dilate(blue, 12)

covered = []
for w in ways:
    if not w["tags"].get("highway"):
        continue
    g = w["geometry"]
    samples = []
    for i in range(len(g) - 1):
        n = max(1, int(hav(g[i], g[i + 1]) // 8))
        for k in range(n):
            t = k / n
            samples.append((g[i]["lat"] + (g[i + 1]["lat"] - g[i]["lat"]) * t, g[i]["lon"] + (g[i + 1]["lon"] - g[i]["lon"]) * t))
    samples.append((g[-1]["lat"], g[-1]["lon"]))
    hit = tot = 0
    for lat, lon in samples:
        x, y = to_px(lat, lon)
        if 0 <= x < W and 0 <= y < H:
            tot += 1; hit += int(blue_wide[int(y), int(x)])
    if tot >= 3:
        cov = hit / tot
        length = sum(hav(g[i], g[i + 1]) for i in range(len(g) - 1))
        covered.append((cov, w, length, tot))

covered.sort(key=lambda t: -t[0])
print("\nruas dengan cakupan garis biru >= 0.5 (cakupan, panjang m, nama, tipe, id, titik awal):")
for cov, w, length, tot in covered:
    if cov < 0.5 or length < 15:
        continue
    g0 = w["geometry"][0]
    print(f"  {cov:.2f}  {length:5.0f} m  {w['tags'].get('name') or '(tanpa nama)':40s} {w['tags']['highway']:14s} {w['id']}  {g0['lat']:.5f},{g0['lon']:.5f}")

# Overlay untuk dicek mata: semua jalan abu-abu, ruas tertutup kuning, marker merah = KM.
ov = im.copy(); dr = ImageDraw.Draw(ov)
for cov, w, length, tot in covered:
    pts = [to_px(p["lat"], p["lon"]) for p in w["geometry"]]
    dr.line(pts, fill=(255, 220, 0) if cov >= 0.5 else (120, 120, 120), width=6 if cov >= 0.5 else 2)
ry, rx = np.nonzero(red)
dr.text((10, 10), f"biru bbox {x_left},{y_top}-{x_right},{y_bottom}", fill=(255, 0, 0))
ov.resize((W // 2, H // 2)).save("/tmp/ref-overlay.png")
mask = np.zeros((H, W, 3), np.uint8); mask[blue] = (80, 160, 255); mask[green] = (60, 200, 80); mask[red] = (220, 60, 60)
Image.fromarray(mask).resize((W // 3, H // 3)).save("/tmp/ref-mask.png")
print("\noverlay: /tmp/ref-overlay.png, mask warna: /tmp/ref-mask.png")
