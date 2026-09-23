"""Pindahkan titik pos marshal (PAM) dari peta panitia ke koordinat peta rute situs.

Sumber: docs/design-reference/pos-pam-2024.png ("POS PAM FUN RUN", 17 titik, 27 personel), peta Google
dengan rute yang sama dengan poster rute. Poster ternyata hampir berupa skala dari peta itu, jadi titik
dipindah dengan transformasi afin yang dicocokkan dari sudut-sudut rute, lalu ditempel ke garis rute
terdekat. Ikon diletakkan di samping garis pada arah yang paling lega.

Pakai: npm run route:marshal  (menulis src/lib/marshal-posts.ts)
Jalankan ulang setiap kali `npm run route:map` membuat ulang route-map.ts: CORNERS memakai indeks
titik jalur poster, jadi cek juga galat afin yang dicetak (seharusnya puluhan piksel, bukan ratusan).
"""
import json, math, re
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "src/lib/route-map.ts").read_text()
rm = json.loads(src[src.index("{"):src.rindex("}") + 1])
P = [tuple(map(float, m)) for m in re.findall(r"(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)", rm["path"])]
VW, VH = map(float, rm["viewBox"].split()[2:])

# Titik PAM (piksel pada pos-pam-2024.png) dan jumlah personel, urut arah lari.
POSTS = [
    ((137, 625), 3), ((148, 977), 1), ((91, 1188), 2), ((394, 1300), 1), ((667, 970), 3),
    ((890, 1063), 1), ((1015, 930), 1), ((1087, 866), 1), ((1170, 764), 1), ((1250, 657), 2),
    ((967, 580), 2), ((705, 412), 2), ((561, 229), 2), ((441, 309), 1), ((305, 434), 1),
    ((551, 563), 1), ((425, 797), 2),
]
# Sudut rute yang sama di kedua peta: piksel PAM -> indeks titik jalur poster.
CORNERS = [((137, 625), 6), ((91, 1188), 10), ((394, 1300), 16), ((667, 970), 17), ((890, 1063), 19),
           ((1250, 657), 24), ((561, 229), 34), ((441, 309), 36), ((345, 292), 37), ((305, 434), 38),
           ((551, 563), 40), ((967, 580), 29)]

X = np.array([[x, y, 1.0] for (x, y), _ in CORNERS])
Y = np.array([P[i] for _, i in CORNERS])
M, *_ = np.linalg.lstsq(X, Y, rcond=None)
res = np.linalg.norm(X @ M - Y, axis=1)
print(f"afin: galat sudut rata-rata {res.mean():.0f} px, maksimum {res.max():.0f} px (lebar peta {VW:.0f})")

cum = [0.0]
for i in range(1, len(P)): cum.append(cum[-1] + math.dist(P[i], P[i - 1]))
def snap(x, y):
    best = (1e18, 0, P[0], 0.0)
    for i in range(len(P) - 1):
        (ax, ay), (bx, by) = P[i], P[i + 1]
        L2 = (bx - ax) ** 2 + (by - ay) ** 2 or 1
        u = max(0.0, min(1.0, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2))
        q = (ax + u * (bx - ax), ay + u * (by - ay)); d = math.dist(q, (x, y))
        if d < best[0]: best = (d, i, q, cum[i] + u * math.sqrt(L2))
    return best

def seg_dist(p, a, b):
    L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 or 1
    u = max(0.0, min(1.0, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2))
    return math.dist(p, (a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])))

# Elemen lain yang tidak boleh tertutup ikon.
obstacles = [(k["x"], k["y"], 150) for k in rm["km"]]
obstacles += [(w["x"], w["y"] - 180, 170) for w in rm["water"]]
obstacles += [(rm[f]["x"] + 60, rm[f]["y"] - 120, 150) for f in ("start", "finish")]
F = rm["field"]
R, ICON = 175, 62   # jarak ikon dari garis, setengah sisi ikon
out = []
for (px, py), people in POSTS:
    tx, ty = np.array([px, py, 1.0]) @ M
    d, i, (sx, sy), s_along = snap(tx, ty)
    best = None
    for k in range(16):
        a = 2 * math.pi * k / 16
        c = (sx + R * math.cos(a), sy + R * math.sin(a))
        if not (ICON + 10 <= c[0] <= VW - ICON - 10 and ICON + 10 <= c[1] <= VH - ICON - 10): continue
        clear = min(seg_dist(c, P[j], P[j + 1]) for j in range(len(P) - 1)) - 75   # 75 = setengah lebar garis + halo
        for ox, oy, orad in obstacles: clear = min(clear, math.dist(c, (ox, oy)) - orad)
        fe = ((c[0] - F["cx"]) / (F["rx"] + ICON)) ** 2 + ((c[1] - F["cy"]) / (F["ry"] + ICON)) ** 2
        if fe < 1: clear = min(clear, -50)
        for o in out: clear = min(clear, math.dist(c, (o["ix"], o["iy"])) - 2 * ICON - 20)
        if best is None or clear > best[0]: best = (clear, c)
    out.append({"x": round(sx), "y": round(sy), "ix": round(best[1][0]), "iy": round(best[1][1]),
                "t": round(s_along / cum[-1], 3), "people": people})
    print(f"PAM ({px},{py}) -> rute ({sx:.0f},{sy:.0f}) geser {d:.0f} px, ruang ikon {best[0]:.0f}")

print(f"{len(out)} pos, {sum(o['people'] for o in out)} personel")
ts = ("// Dihasilkan oleh tools/map-marshal-posts.py dari peta pos PAM panitia. Jangan diedit manual.\n"
      "// x,y = titik pos di garis rute; ix,iy = posisi ikon; people = jumlah personel di pos itu.\n"
      "export const marshalPosts = " + json.dumps(out, indent=2) + " as const;\n")
(ROOT / "src/lib/marshal-posts.ts").write_text(ts)

# gambar cek
from PIL import Image, ImageDraw
img = Image.new("RGB", (int(VW), int(VH)), (20, 60, 40)); dr = ImageDraw.Draw(img)
dr.line(P, fill=(250, 200, 0), width=110)
for k in rm["km"]: dr.regular_polygon((k["x"], k["y"], 88), 8, fill=(255, 187, 0))
for o in out:
    dr.line([(o["x"], o["y"]), (o["ix"], o["iy"])], fill=(255, 255, 255), width=8)
    dr.ellipse([o["x"] - 30, o["y"] - 30, o["x"] + 30, o["y"] + 30], fill=(200, 30, 30))
    dr.rectangle([o["ix"] - ICON, o["iy"] - ICON, o["ix"] + ICON, o["iy"] + ICON], fill=(11, 74, 44), outline=(255, 255, 255), width=6)
F = rm["field"]; dr.ellipse([F["cx"] - F["rx"], F["cy"] - F["ry"], F["cx"] + F["rx"], F["cy"] + F["ry"]], outline=(100, 200, 100), width=10)
img.resize((int(VW / 4), int(VH / 4))).save("/tmp/marshal-posts-debug.png")
print("cek /tmp/marshal-posts-debug.png")
