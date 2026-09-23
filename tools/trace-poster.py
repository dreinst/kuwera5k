"""Ekstrak semua elemen peta rute dari poster panitia dan tulis data peta situs.

Pakai: python3 tools/trace-poster.py "<poster.jpg>"
Output: public/images/route-map-bg.png (latar jalan poster, garis putih transparan),
        src/lib/route-map.ts (jalur, bendera, water station, KM, marshal, panah, lapangan),
        /tmp/poster-debug.png (overlay untuk dicek).
Butuh pillow + numpy.
"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1])
im = Image.open(src).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.float32) / 255
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx, mn = a.max(-1), a.min(-1)
v = mx
s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
d = np.maximum(mx - mn, 1e-6)
h = (np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60)

# --- bingkai merah -> bidang peta (panel putih) ---
frame_red = ((h < 12) | (h > 348)) & (s > 0.55) & (v > 0.55)
top80 = np.zeros((H, W), bool); top80[: int(H * 0.79)] = True
panel = (~frame_red) & top80
# panel = kolom/baris yang mayoritas bukan merah, di bagian atas gambar
cols = np.where(panel[: int(H * 0.5)].mean(0) > 0.5)[0]
rows = np.where(panel[:, W // 4 : 3 * W // 4].mean(1) > 0.5)[0]
rows = rows[rows < int(H * 0.79)]
px0, px1, py0, py1 = int(cols.min()), int(cols.max()), int(rows.min()), int(rows.max())
print(f"gambar {W}x{H}, panel x {px0}-{px1} y {py0}-{py1}")
inside = np.zeros((H, W), bool); inside[py0:py1, px0:px1] = True

def components(mask, min_px):
    """Komponen terhubung sederhana (4-arah) via label flood fill dengan numpy stack."""
    from collections import deque
    lab = np.zeros(mask.shape, np.int32); n = 0; comps = []
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        n += 1; q = deque([(y0, x0)]); lab[y0, x0] = n; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                yy, xx = y+dy, x+dx
                if 0 <= yy < mask.shape[0] and 0 <= xx < mask.shape[1] and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; q.append((yy, xx))
        if len(pts) >= min_px:
            arr = np.array(pts); comps.append({"n": len(pts), "cy": float(arr[:,0].mean()), "cx": float(arr[:,1].mean()),
                "y0": int(arr[:,0].min()), "y1": int(arr[:,0].max()), "x0": int(arr[:,1].min()), "x1": int(arr[:,1].max()), "pts": arr})
    return comps

# kerja di skala 1/4 untuk komponen dan skeleton
f = 4
def small(m):
    Hs, Ws = m.shape[0] // f, m.shape[1] // f
    return m[:Hs*f, :Ws*f].reshape(Hs, f, Ws, f).max(axis=(1, 3))

# --- garis rute biru ---
blue = (h > 195) & (h < 222) & (s > 0.45) & (v > 0.55) & inside
bs = small(blue)
def dil(x, k=1):
    y = x.copy()
    for _ in range(k):
        z = y.copy()
        for dy in (-1,0,1):
            for dx in (-1,0,1): z |= np.roll(np.roll(y, dy, 0), dx, 1)
        y = z
    return y
def ero(x, k=1):
    y = x.copy()
    for _ in range(k):
        z = y.copy()
        for dy in (-1,0,1):
            for dx in (-1,0,1): z &= np.roll(np.roll(y, dy, 0), dx, 1)
        y = z
    return y
bs = ero(dil(bs, 6), 6)  # tutup celah bekas panah hitam di atas garis, sebelum pilih komponen
comps = components(bs, 200)
route = max(comps, key=lambda c: c["n"])
rm = np.zeros(bs.shape, bool); rm[route["pts"][:,0], route["pts"][:,1]] = True
print(f"komponen rute {route['n']} px (skala 1/{f}), komponen biru lain: {[c['n'] for c in comps if c is not route][:8]}")
# Tambal garis: pin water station dan panah menutupi garis; masukkan pin ke mask lalu closing.
ws_small = small((h > 205) & (h < 240) & (s > 0.5) & (v > 0.25) & (v < 0.62) & inside)
rm = rm | (dil(ws_small, 2) & dil(rm, 4))
rm = ero(dil(rm, 3), 3)

Hs, Ws = rm.shape
dirs = [(0,-1),(-1,-1),(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1)]
def trace_boundary(mask):
    ys_, xs_ = np.nonzero(mask)
    i0 = int(np.argmin(ys_ * Ws + xs_)); sy, sx = int(ys_[i0]), int(xs_[i0])
    def ins(y, x): return 0 <= y < Hs and 0 <= x < Ws and mask[y, x]
    boundary = [(sy, sx)]; cur = (sy, sx); back = (sy, sx - 1)
    def dir_index(c, q): return dirs.index((q[0]-c[0], q[1]-c[1]))
    prev_dir = dir_index(cur, back)
    while True:
        found = False
        for k in range(1, 9):
            di = (prev_dir + k) % 8
            ny, nx = cur[0] + dirs[di][0], cur[1] + dirs[di][1]
            if ins(ny, nx):
                bdi = (di - 1) % 8; back = (cur[0] + dirs[bdi][0], cur[1] + dirs[bdi][1])
                cur = (ny, nx); found = True; break
        if not found or (cur == (sy, sx) and len(boundary) > 10) or len(boundary) > 100000: break
        boundary.append(cur); prev_dir = dir_index(cur, back)
    return boundary

boundary = trace_boundary(rm)
w2 = 0.5 * rm.sum() / len(boundary)
# Deteksi ujung terputus (garis "berbalik arah"): titik i dan i+M sangat dekat.
Barr = np.array(boundary, float); N = len(boundary); M = 40
dd = np.hypot(*(Barr - np.roll(Barr, -M, 0)).T)
thr = 3.5 * w2
cands = [i for i in range(N) if dd[i] < thr and dd[i] <= dd[(i-1) % N] and dd[i] <= dd[(i+1) % N]]
caps = []
for i in sorted(cands, key=lambda i: dd[i]):
    if all(min(abs(i-c), N-abs(i-c)) > 4*M for c in caps): caps.append(i)
caps = caps[:2]
lm = sorted([i for i in range(N) if dd[i] <= dd[(i-1) % N] and dd[i] <= dd[(i+1) % N]], key=lambda i: dd[i])[:8]
print("  minima lokal d(i,i+M):", [(i, round(float(dd[i]), 1), tuple(int(v) for v in Barr[i])) for i in lm])
print(f"tepi {N} px, setengah lebar {w2:.1f}, ambang {thr:.1f}, ujung terputus: {len(caps)}")
if len(caps) == 2:
    from PIL import ImageDraw as _ID
    def cap_geom(i):
        C = (Barr[i] + Barr[(i+M) % N]) / 2
        P = (Barr[(i-60) % N] + Barr[(i+M+60) % N]) / 2
        d_ = C - P; d_ = d_ / (np.hypot(*d_) or 1)
        return C, d_
    C1, d1 = cap_geom(caps[0]); C2, d2 = cap_geom(caps[1])
    # titik potong garis C1+t*d1 dan C2+u*d2
    A_ = np.array([[d1[0], -d2[0]], [d1[1], -d2[1]]]); rhs = C2 - C1
    bridge = [C1, C2]
    try:
        t, u = np.linalg.solve(A_, rhs)
        X = C1 + t * d1
        if 0 < t < 120 and 0 < u < 120: bridge = [C1, X, C2]
    except np.linalg.LinAlgError: pass
    print(f"  jembatan lewat {[tuple(np.round(p).astype(int)) for p in bridge]} (y,x)")
    canvas = Image.fromarray(rm.astype(np.uint8) * 255)
    _ID.Draw(canvas).line([(float(p[1]), float(p[0])) for p in bridge], fill=255, width=int(round(2 * w2)) + 1, joint="curve")
    rm = np.asarray(canvas) > 0
    boundary = trace_boundary(rm)
    route = {"n": int(rm.sum())}
outer_len = len(boundary)
w2 = 0.5 * route["n"] / outer_len
print(f"tepi luar {outer_len} px, setengah lebar garis {w2:.1f} px (skala 1/{f})")
def dp(points, tol):
    if len(points) < 3: return points
    arr = np.array(points, float); s0, e0 = arr[0], arr[-1]
    dx, dy = e0 - s0; nrm = math.hypot(dx, dy) or 1
    dist = np.abs((arr[:,0]-s0[0])*dy - (arr[:,1]-s0[1])*dx) / nrm
    i = int(dist.argmax())
    if dist[i] > tol: return dp(points[:i+1], tol)[:-1] + dp(points[i:], tol)
    return [points[0], points[-1]]
def dp_closed(points, tol):
    # DP pada loop tertutup: pecah di titik terjauh dari titik pertama supaya garis dasar tidak nol
    p0 = np.array(points[0], float); arr = np.array(points, float)
    k = int(((arr - p0) ** 2).sum(1).argmax())
    return dp(points[:k+1], tol)[:-1] + dp(points[k:] + [points[0]], tol)[:-1]
outer = [(p[1], p[0]) for p in dp_closed(boundary, 2.0)]  # (x,y) skala kecil, loop terbuka di ujung
area2 = sum(outer[i][0]*outer[(i+1)%len(outer)][1] - outer[(i+1)%len(outer)][0]*outer[i][1] for i in range(len(outer)))
if area2 < 0: outer = outer[::-1]  # jadikan searah jarum jam (koordinat y ke bawah)
def edge_normal(p, q):
    dx, dy = q[0]-p[0], q[1]-p[1]; n = math.hypot(dx, dy) or 1
    return (-dy/n, dx/n)  # normal ke dalam untuk poligon searah jarum jam, y ke bawah
center = []
n = len(outer)
for i in range(n):
    p0, p1, p2 = outer[i-1], outer[i], outer[(i+1) % n]
    n0, n1 = edge_normal(p0, p1), edge_normal(p1, p2)
    bx, by = n0[0]+n1[0], n0[1]+n1[1]; bl = math.hypot(bx, by)
    if bl < 1e-6: bx, by, bl = n1[0], n1[1], 1.0
    bx, by = bx/bl, by/bl
    cosh = max(0.45, bx*n1[0] + by*n1[1])  # miter, dibatasi
    center.append((p1[0] + bx * w2 / cosh, p1[1] + by * w2 / cosh))
poly = [(x*f + f/2, y*f + f/2) for x, y in dp_closed(center, 1.2)]
poly.append(poly[0])
print(f"titik garis tengah {len(poly)}")

# --- elemen lain (skala penuh, komponen di skala 1/4) ---
def comps_of(mask, min_px):
    cs = components(small(mask & inside), min_px)
    for c in cs:
        for k in ("cx","cy","x0","x1","y0","y1"): c[k] = c[k]*f
    return cs
# oktagon KM: merah tua
km_mask = ((h < 15) | (h > 345)) & (s > 0.5) & (v > 0.25) & (v < 0.72)
kms = comps_of(km_mask, 150)
kms = [c for c in kms if 0.7 < (c["x1"]-c["x0"]+1)/(c["y1"]-c["y0"]+1) < 1.4][:6]
# bendera finish: merah terang
fin_mask = ((h < 15) | (h > 345)) & (s > 0.6) & (v > 0.75)
fins = comps_of(fin_mask, 60)
# bendera start: hijau terang
st_mask = (h > 95) & (h < 140) & (s > 0.55) & (v > 0.75)
sts = comps_of(st_mask, 60)
# lapangan: hijau lebih gelap, komponen terbesar
field_mask = (h > 100) & (h < 150) & (s > 0.4) & (v > 0.3) & (v < 0.75)
fields = comps_of(field_mask, 400)
field = max(fields, key=lambda c: c["n"]) if fields else None
# water station: biru tua pin
ws_mask = (h > 205) & (h < 240) & (s > 0.5) & (v > 0.25) & (v < 0.62)
wss = comps_of(ws_mask, 80)
# marshal + panah: hitam
blk = (v < 0.22) & inside
blks = comps_of(blk, 60)
marshals, arrows = [], []
for c in blks:
    w_, h_ = c["x1"]-c["x0"]+1, c["y1"]-c["y0"]+1
    fill = c["n"]*f*f / (w_*h_)
    if 0.75 < w_/h_ < 1.33 and c["n"]*f*f > 2500 and w_ > 45 and fill > 0.45: marshals.append(c)
    elif c["n"]*f*f > 300: arrows.append(c)
# Garis tepi hitam oktagon KM dan bendera ikut terdeteksi sebagai blob hitam; itu bukan panah.
def near_any(c, comps, pad):
    return any(k["x0"] - pad <= c["cx"] <= k["x1"] + pad and k["y0"] - pad <= c["cy"] <= k["y1"] + pad for k in comps)
arrows = [c for c in arrows if not near_any(c, kms + sts + fins, 40)]
# --- arah jalur: di sisi kiri poster panah mengarah ke bawah; mulai dari proyeksi bendera start ---
def project_point(x, y):
    best, bi, bp = 1e18, 0, poly[0]
    for i in range(len(poly)-1):
        ax, ay = poly[i]; bx, by = poly[i+1]
        L2 = (bx-ax)**2 + (by-ay)**2 or 1
        t = max(0, min(1, ((x-ax)*(bx-ax)+(y-ay)*(by-ay))/L2))
        px_, py_ = ax+t*(bx-ax), ay+t*(by-ay); dd = (px_-x)**2+(py_-y)**2
        if dd < best: best, bi, bp = dd, i, (px_, py_)
    return bi, bp
def rotate_to_start():
    global poly
    st = max(sts, key=lambda c: c["n"]); si, sp = project_point(st["cx"], st["y1"])
    ring = poly[:-1]
    ring = [sp] + ring[si+1:] + ring[:si+1]
    poly = ring + [sp]
if sts:
    rotate_to_start()
    # Dari start, poster bergerak ke barat (menyusuri sisi selatan lapangan menuju Panglima Sudirman).
    if poly[3][0] > poly[0][0]:
        poly = poly[::-1]
        rotate_to_start()

# --- Start dan finish berbentuk U (arahan panitia 23 Sep 2026, sesuai poster dan foto satelit) ---
# Penelusuran garis tengah melebur lajur-lajur sejajar di Jl. Urip Sumoharjo jadi zig-zag, jadi bagian
# ini dibangun ulang dari ukuran poster (koordinat panel, sumbu k searah Urip Sumoharjo ke tenggara):
#   start : titik S/F di lajur tengah -> tenggara -> putar balik di simpang Ronggolawe -> lajur luar ke
#           barat laut -> pojok barat (lanjut turun Panglima Sudirman seperti poster)
#   finish: turun Ronggolawe -> lajur dalam (paling dekat lapangan) ke barat laut -> titik S/F yang sama
PANEL = np.array([px0, py0], float)
def _nearest(pt):
    q = np.array(pt, float) + PANEL
    return int(np.argmin([math.hypot(x - q[0], y - q[1]) for x, y in poly]))
iN, iE = _nearest((431, 1531)), _nearest((1385, 1646))
N0 = np.array(poly[iN], float) - PANEL
U_DIR = np.array([0.83, 0.557]); U_DIR /= np.linalg.norm(U_DIR)
N_DIR = np.array([U_DIR[1], -U_DIR[0]])             # tegak lurus, mengarah ke lapangan
K_SF, K_UTURN, OFF_OUT, OFF_FIN = 440, 930, 80, 160  # lajur luar di offset 0
LANE_W = 56                                          # lebar lajur S/F (garis utama 118); celah antarlajur 24
lane = lambda k, off: N0 + k * U_DIR + off * N_DIR
start_part = [lane(k, OFF_OUT) for k in (K_SF, (K_SF + K_UTURN) / 2, K_UTURN)]
centre = lane(K_UTURN, OFF_OUT / 2)
for th in np.linspace(0, math.pi, 10)[1:-1]:
    start_part.append(centre + (OFF_OUT / 2) * (math.cos(th) * N_DIR + math.sin(th) * U_DIR))
start_part += [lane(K_UTURN, 0), lane(K_UTURN / 2, 0)]
E0 = np.array(poly[iE], float) - PANEL
dE = (np.array(poly[iE + 1], float) - PANEL) - E0; dE /= np.linalg.norm(dE)
off_of = lambda q: float(np.dot(q - N0, N_DIR))
s_at = lambda target: (off_of(E0) - target) / (-float(np.dot(dE, N_DIR)))
P_end = E0 + s_at(OFF_FIN + (118 - LANE_W) / 2) * dE   # garis utama berhenti sebelum menyentuh lajur tengah
J_fin = E0 + s_at(OFF_FIN) * dE
k_J = float(np.dot(J_fin - N0, U_DIR))
finish_part = [J_fin, lane((K_SF + k_J) / 2, OFF_FIN), lane(K_SF, OFF_FIN)]
to_px = lambda q: (float(q[0] + PANEL[0]), float(q[1] + PANEL[1]))
seg_start = [to_px(q) for q in start_part] + [poly[iN]]
seg_main = poly[iN:iE + 1] + [to_px(P_end)]
seg_finish = [to_px(P_end)] + [to_px(q) for q in finish_part]
poly = seg_start + seg_main[1:] + seg_finish[1:]
i_main0 = len(seg_start) - 1
i_fin0 = i_main0 + len(seg_main) - 1
SF_POINT = lane(K_SF, (OFF_OUT + OFF_FIN) / 2)
print(f"start/finish U: {len(seg_start)} titik start, {len(seg_finish)} titik finish, S/F di {SF_POINT.round(1)}")
def route_tangent(x, y):
    i, _ = project_point(x, y); ax, ay = poly[i]; bx, by = poly[i+1]
    d_ = math.hypot(x - _[0], y - _[1])
    return math.degrees(math.atan2(by-ay, bx-ax)), d_
# Panah ditempel ke garis tengah rute; arahnya diambil dari titik 150 px sebelum dan sesudahnya
# (bukan dari satu potongan garis terdekat, yang bisa berupa belokan kecil hasil penelusuran).
_cum = [0.0]
for i in range(1, len(poly)): _cum.append(_cum[-1] + math.hypot(poly[i][0]-poly[i-1][0], poly[i][1]-poly[i-1][1]))
def point_at(s_):
    s_ = max(0.0, min(_cum[-1], s_))
    for i in range(len(poly)-1):
        if _cum[i+1] >= s_:
            L = (_cum[i+1] - _cum[i]) or 1; u = (s_ - _cum[i]) / L
            return (poly[i][0] + u*(poly[i+1][0]-poly[i][0]), poly[i][1] + u*(poly[i+1][1]-poly[i][1]))
    return poly[-1]
arrow_out = []
for c in arrows:
    i, pp = project_point(c["cx"], c["cy"])
    dist = math.hypot(c["cx"] - pp[0], c["cy"] - pp[1])
    if dist >= 150: continue
    s_ = _cum[i] + math.hypot(pp[0]-poly[i][0], pp[1]-poly[i][1])
    a0, a1 = point_at(s_ - 150), point_at(s_ + 150)
    ang = math.degrees(math.atan2(a1[1]-a0[1], a1[0]-a0[0]))
    arrow_out.append({"x": round(pp[0]), "y": round(pp[1]), "angle": round(ang)})
# Panah tambahan di lajur S/F supaya arah bentuk U terbaca (lajur tengah ke tenggara, lajur dalam ke barat laut).
for k_, off_, sign in ((700, OFF_OUT, 1), (680, OFF_FIN, -1)):
    q = to_px(lane(k_, off_))
    arrow_out.append({"x": round(q[0]), "y": round(q[1]), "angle": round(math.degrees(math.atan2(sign * U_DIR[1], sign * U_DIR[0])))})
print(f"titik jalur {len(poly)}, panah di jalur {len(arrow_out)} dari {len(arrows)} blob + 2 tambahan")

# jarak kumulatif (satuan piksel) untuk urutan KM
cum = [0.0]
for i in range(1, len(poly)): cum.append(cum[-1] + math.hypot(poly[i][0]-poly[i-1][0], poly[i][1]-poly[i-1][1]))
def along(x, y):
    i, pp = project_point(x, y); return cum[i] + math.hypot(pp[0]-poly[i][0], pp[1]-poly[i][1])
kms_sorted = sorted(kms, key=lambda c: along(c["cx"], c["cy"]))
km_out = [{"km": i+1, "x": round(c["cx"]), "y": round(c["cy"])} for i, c in enumerate(kms_sorted)]
print("KM:", km_out)

# --- latar jalan: garis abu-abu poster jadi putih transparan ---
crop = a[py0:py1, px0:px1]
lum = crop @ np.array([0.299, 0.587, 0.114], np.float32)
sat = s[py0:py1, px0:px1]; val = v[py0:py1, px0:px1]
colored = dil(((sat > 0.28) | (val < 0.45))[::1, ::1], 1) if False else ((sat > 0.28) | (val < 0.45))
# perluas mask elemen berwarna/hitam supaya tidak ada sisa tepi
cm = colored
for _ in range(6): cm = cm | np.roll(cm, 1, 0) | np.roll(cm, -1, 0) | np.roll(cm, 1, 1) | np.roll(cm, -1, 1)
alpha = np.clip((1.0 - lum) / 0.30, 0, 1); alpha[cm] = 0
bg = np.zeros((crop.shape[0], crop.shape[1], 4), np.uint8); bg[..., :3] = 255
bg[..., 3] = (alpha * 235).astype(np.uint8)
target_w = 1400
bg_img = Image.fromarray(bg, "RGBA").resize((target_w, round(crop.shape[0] * target_w / crop.shape[1])), Image.LANCZOS)
out_bg = ROOT / "public" / "images" / "route-map-bg.webp"
bg_img.save(out_bg, "WEBP", quality=82, method=6)
old_png = ROOT / "public" / "images" / "route-map-bg.png"
if old_png.exists(): old_png.unlink()
print(f"latar {out_bg.name}: {bg_img.size}, {out_bg.stat().st_size // 1024} KB")

# --- tulis data (koordinat relatif panel, viewBox = ukuran panel) ---
VW, VH = px1 - px0, py1 - py0
rx = lambda x: round(x - px0, 1); ry = lambda y: round(y - py0, 1)
to_d = lambda pts: "".join(f"{'M' if i == 0 else 'L'}{rx(x)},{ry(y)}" for i, (x, y) in enumerate(pts))
path = to_d(poly)
t_main0, t_fin0 = cum[i_main0] / cum[-1], cum[i_fin0] / cum[-1]
segments = [
    {"d": to_d(poly[: i_main0 + 1]), "lane": True, "t0": 0, "t1": round(t_main0, 4)},
    {"d": to_d(poly[i_main0 : i_fin0 + 1]), "lane": False, "t0": round(t_main0, 4), "t1": round(t_fin0, 4)},
    {"d": to_d(poly[i_fin0:]), "lane": True, "t0": round(t_fin0, 4), "t1": 1},
]
sf = {"x": round(float(SF_POINT[0]), 1), "y": round(float(SF_POINT[1]), 1)}
data = {
    "viewBox": f"0 0 {VW} {VH}",
    "background": "/images/route-map-bg.webp",
    "path": path,
    "segments": segments,
    "laneWidth": LANE_W,
    "lengthPx": round(cum[-1]),
    # start dan finish di titik yang sama (antara ujung lajur tengah dan lajur dalam)
    "start": sf,
    "finish": sf,
    "field": {"cx": rx(field["cx"]), "cy": ry(field["cy"]), "rx": round((field["x1"]-field["x0"])/2), "ry": round((field["y1"]-field["y0"])/2), "label": "LAP RAMPAL"} if field else None,
    "km": [{"km": k["km"], "x": rx(k["x"]), "y": ry(k["y"]), "t": round(along(k["x"], k["y"]) / cum[-1], 3)} for k in km_out],
    "water": [{"x": rx(c["cx"]), "y": ry(c["y1"]), "t": round(along(c["cx"], c["y1"]) / cum[-1], 3)} for c in wss],
    "marshals": [{"x": rx(c["cx"]), "y": ry(c["cy"])} for c in marshals],
    "arrows": [{"x": rx(a_["x"]), "y": ry(a_["y"]), "angle": a_["angle"], "t": (t_ := round(along(a_["x"], a_["y"]) / cum[-1], 3)),
                "scale": round((LANE_W - 16) / 64, 2) if (t_ < t_main0 or t_ > t_fin0) else 1} for a_ in arrow_out],
}
print(f"start {data['start']} finish {data['finish']} water {len(data['water'])} marshal {len(data['marshals'])} panah {len(data['arrows'])} lapangan {data['field']}")
ts = "// Dihasilkan oleh tools/trace-poster.py dari poster rute resmi panitia. Jangan diedit manual.\nexport const routeMap = " + json.dumps(data, indent=2, ensure_ascii=False) + " as const;\n"
(ROOT / "src" / "lib" / "route-map.ts").write_text(ts)

# --- debug overlay ---
dbg = im.copy(); dr = ImageDraw.Draw(dbg)
dr.line(poly, fill=(255, 200, 0), width=10)
for k in km_out: dr.ellipse([k["x"]-40, k["y"]-40, k["x"]+40, k["y"]+40], outline=(255,0,255), width=8); dr.text((k["x"]+45, k["y"]-20), str(k["km"]), fill=(255,0,255))
for c in wss: dr.ellipse([c["cx"]-30, c["y1"]-30, c["cx"]+30, c["y1"]+30], outline=(0,255,255), width=8)
for c in marshals: dr.rectangle([c["x0"], c["y0"], c["x1"], c["y1"]], outline=(0,255,0), width=6)
for a_ in arrow_out:
    x, y, ang = a_["x"], a_["y"], math.radians(a_["angle"])
    dr.line([(x, y), (x + 80*math.cos(ang), y + 80*math.sin(ang))], fill=(255,0,0), width=8)
if sts: dr.ellipse([data["start"]["x"]+px0-35, data["start"]["y"]+py0-35, data["start"]["x"]+px0+35, data["start"]["y"]+py0+35], outline=(0,255,0), width=8)
if fins: dr.ellipse([data["finish"]["x"]+px0-35, data["finish"]["y"]+py0-35, data["finish"]["x"]+px0+35, data["finish"]["y"]+py0+35], outline=(255,0,0), width=8)
if field: dr.ellipse([field["x0"], field["y0"], field["x1"], field["y1"]], outline=(0,128,255), width=8)
dr.rectangle([px0, py0, px1, py1], outline=(255,0,255), width=6)
dbg.resize((W//3, H//3)).save("/tmp/poster-debug.png"); print("debug /tmp/poster-debug.png")
