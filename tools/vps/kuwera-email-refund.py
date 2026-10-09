#!/usr/bin/env python3
"""Email dan kabar refund pembatalan KUWERA (9 Okt 2026). Dijalankan timer systemd tiap menit, hanya bekerja selama
Setting "refund" aktif. Tugas tiap putaran:
1. Kirim tautan refund pribadi ke pemesan yang memintanya di halaman /refund (kolom Order.refundLinkAt).
2. Kirim email sesuai status pengajuan: tanda terima, permintaan perbaikan rekening, dan bukti transfer saat selesai.
3. Setiap ada pengajuan baru atau rekening diganti, kirim rekap rekening yang menunggu transfer ke DM Discord superadmin.
4. Pengingat ke pemesan yang belum mengajukan pada hari ke-14 dan ke-25 sejak pengumuman (setelah --umumkan dijalankan).

Dipasang sebagai /usr/local/bin/kuwera-email-refund. Pengirim, token Gmail, dan akses database sama dengan
kuwera-email-tiket (fungsinya dimuat dari berkas itu). Catatan kiriman ada di /var/lib/kuwera-email/refund.json.

  kuwera-email-refund                    satu putaran tugas di atas
  kuwera-email-refund --umumkan          email pengumuman + tautan pribadi ke semua pemesan lunas yang belum mengajukan (sekali per order)
  kuwera-email-refund --umumkan --kering tampilkan siapa yang akan dikirimi, tanpa mengirim
  kuwera-email-refund --uji A            kirim contoh pengumuman (order lunas pertama) ke alamat A, tanpa mencatat
  kuwera-email-refund --rekap            kirim rekap rekening ke DM superadmin sekarang
"""
import base64, hashlib, hmac, json, os, sys, time, urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from importlib.machinery import SourceFileLoader

T = SourceFileLoader("kuwera_email_tiket", "/usr/local/bin/kuwera-email-tiket").load_module()
db, rupiah, SITE, WA_BANTUAN = T.db, T.rupiah, T.SITE, T.WA_BANTUAN
STATE = "/var/lib/kuwera-email/refund.json"
SUPERADMIN = "530752864172113930"  # id Discord superadmin, sama dengan dpro-dm-superadmin.py
MAKS = 40  # batas email per putaran
BATAS_HARI, PROSES = 30, "paling lama 7 hari kerja"
INGAT = (14, 25)  # hari sejak pengumuman
SALAM = f"\n\nKalau ada yang ingin ditanyakan, Kakak bisa chat panitia di WhatsApp {WA_BANTUAN} atau membalas email ini.\n\nPanitia KUWERA Fun Run 5K"

# Semua order lunas atau sudah direfund (tanpa data uji), dengan pengajuannya kalau ada. Bukti transfer diambil terpisah.
SQL = """select coalesce(json_agg(x order by x.paid), '[]') from (
  select o.id, o.total, o."buyerEmail" as email, o.status, o."paidAt" as paid, o."refundLinkAt" as minta,
         (select p."fullName" from "Participant" p where p."orderId" = o.id order by p.position limit 1) as pemesan,
         (select json_agg(t.code order by t.code) from "Ticket" t where t."orderId" = o.id) as tiket,
         (select json_build_object('status', r.status, 'nominal', r.amount, 'metode', r.method, 'bank', r.provider, 'nomor', r."accountNumber",
                 'nama', r."accountName", 'catatan', r.note, 'data', r."dataNote", 'ubah', r."updatedAt", 'transfer', r."transferredAt")
            from "RefundRequest" r where r."orderId" = o.id) as r
    from "Order" o
   where o.status in ('PAID', 'REFUNDED') and not o."isTest" and o."buyerEmail" like '%@%') x"""


def tautan(cfg, oid):
    k = base64.urlsafe_b64encode(hmac.new(cfg["kunci"].encode(), f"refund:{oid}".encode(), hashlib.sha256).digest()).decode().rstrip("=")[:24]
    return f"{SITE}/refund/{oid}?k={k}"


def nominal(cfg, o):
    return (o["r"] or {}).get("nominal") or cfg.get("nominal", {}).get(o["id"], o["total"])


def tgl(iso, jam=False):
    """Waktu database (UTC tanpa zona) ke tanggal WIB, misalnya 9 Oktober 2026."""
    d = datetime.fromisoformat(iso.replace("Z", "")[:19]) + timedelta(hours=7)
    bulan = "Januari Februari Maret April Mei Juni Juli Agustus September Oktober November Desember".split()[d.month - 1]
    return f"{d.day} {bulan} {d.year}" + (f" pukul {d:%H.%M} WIB" if jam else "")


def samar(nomor):
    return "•" * max(0, len(nomor) - 4) + nomor[-4:]


def kirim(token, tujuan, judul, teks, lampiran=None):
    m = EmailMessage()
    m["From"], m["To"], m["Subject"] = formataddr(T.DARI), tujuan, judul
    m.set_content(teks)
    if lampiran:
        nama, mime, data = lampiran
        m.add_attachment(data, maintype=mime.split("/")[0], subtype=mime.split("/")[1], filename=nama)
    body = json.dumps({"raw": base64.urlsafe_b64encode(m.as_bytes()).decode()}).encode()
    req = urllib.request.Request("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", data=body,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())["id"]


def sapa(o):
    return f"Halo Kak {(o['pemesan'] or '').split(' ')[0] or 'pelari'},\n\n"


def isi_umum(cfg, o, ingat=False):
    batas = tgl((datetime.fromisoformat(cfg["diumumkan"].replace("Z", "")) + timedelta(days=BATAS_HARI)).isoformat()) if cfg.get("diumumkan") else None
    buka = ("Kami ingin mengingatkan dengan hormat bahwa uang pendaftaran order " + o["id"] + " belum diajukan pengembaliannya. "
            "KUWERA Fun Run 5K 2026 batal diselenggarakan, dan kami mohon maaf atas kabar ini." if ingat else
            "Dengan berat hati kami sampaikan bahwa KUWERA Fun Run 5K 2026 batal diselenggarakan. Kami mohon maaf kepada Kakak yang sudah mendaftar dan menantikan hari lomba.")
    teks = sapa(o) + buka + "\n\n" + "\n".join([
        f"Uang pendaftaran order {o['id']} sebesar {rupiah(nominal(cfg, o))} kami kembalikan 100%, termasuk kode unik. Biaya transfernya kami yang tanggung.",
        "",
        "Untuk mengajukan, buka tautan pribadi di bawah ini lalu isi rekening bank atau dompet digital tujuan:",
        tautan(cfg, o["id"]),
        "",
        f"Dana kami transfer {PROSES} setelah data rekening lengkap, dan bukti transfernya kami kirim ke email ini."
        + (f" Pengajuan kami buka sampai {batas}." if batas else ""),
        "Tautan di atas khusus untuk order Kakak, jadi mohon tidak dibagikan ke orang lain.",
    ]) + SALAM
    judul = ("Pengingat: refund KUWERA Fun Run 5K belum diajukan" if ingat else "KUWERA Fun Run 5K dibatalkan, uang pendaftaran kembali 100%") + f" (order {o['id']})"
    return judul, teks


def isi_tautan(cfg, o):
    return (f"Tautan refund KUWERA Fun Run 5K (order {o['id']})",
            sapa(o) + f"Ini tautan refund untuk order {o['id']} yang Kakak minta di website:\n{tautan(cfg, o['id'])}\n\n"
            f"Di halaman itu Kakak bisa melihat nominal yang dikembalikan ({rupiah(nominal(cfg, o))}) dan mengisi rekening tujuan. "
            "Tautannya khusus untuk order Kakak, jadi mohon tidak dibagikan ke orang lain.\n\nKalau Kakak tidak merasa memintanya, email ini boleh diabaikan." + SALAM)


def isi_status(cfg, o):
    r, link = o["r"], tautan(cfg, o["id"])
    rek = f"{r['bank']} {samar(r['nomor'])} atas nama {r['nama']}"
    if r["status"] == "DIAJUKAN":
        return (f"Pengajuan refund order {o['id']} sudah kami terima",
                sapa(o) + f"Pengajuan refund order {o['id']} sudah kami terima. Mohon maaf sekali lagi atas pembatalan acaranya.\n\n"
                f"Nominal: {rupiah(r['nominal'])}\nTujuan: {rek}\n\nDana kami transfer {PROSES}. Begitu terkirim, bukti transfernya kami kirim ke email ini.\n\n"
                f"Status dan data rekening bisa Kakak lihat atau ubah di sini:\n{link}" + SALAM)
    if r["status"] == "PERLU_PERBAIKAN":
        return (f"Data rekening refund order {o['id']} perlu diperbaiki",
                sapa(o) + f"Mohon maaf, dana refund order {o['id']} belum bisa kami transfer karena data rekeningnya perlu dicek lagi.\n\n"
                f"Catatan panitia: {r['catatan'] or 'mohon periksa lagi data rekeningnya.'}\n\nKakak bisa memperbaikinya di sini:\n{link}" + SALAM)
    return (f"Dana refund order {o['id']} sudah kami transfer",
            sapa(o) + f"Dana refund order {o['id']} sebesar {rupiah(r['nominal'])} sudah kami transfer ke {rek}"
            + (f" pada {tgl(r['transfer'])}" if r.get("transfer") else "") + ". Bukti transfernya terlampir di email ini.\n\n"
            "Tiket di order ini sudah tidak berlaku. Terima kasih atas pengertian Kakak, semoga kita bertemu di acara berikutnya." + SALAM)


def bukti(oid):
    d = db(f"""select json_build_object('nama', r."proofName", 'mime', r."proofMime", 'data', encode(r."proofData", 'base64'))
               from "RefundRequest" r where r."orderId" = '{oid}' and r."proofData" is not null""") if oid.replace("-", "").isalnum() else None
    return (d["nama"], d["mime"], base64.b64decode(d["data"])) if d else None


def rekap(semua, cfg):
    """Rekening yang menunggu transfer ke DM Discord superadmin: rekening, nominal, nomor tiket, tanggal bayar."""
    antre = [o for o in semua if o["r"] and o["r"]["status"] == "DIAJUKAN"]
    selesai = [o for o in semua if o["r"] and o["r"]["status"] == "SELESAI"]
    kepala = (f"<@{SUPERADMIN}> KUWERA refund: {len(antre)} pengajuan menunggu transfer, total {rupiah(sum(o['r']['nominal'] for o in antre))}. "
              f"Sudah selesai {len(selesai)} order ({rupiah(sum(o['r']['nominal'] for o in selesai))}), belum mengajukan {sum(1 for o in semua if not o['r'])} order.")
    butir = [f"{i}. {o['r']['bank']} {o['r']['nomor']} a.n. {o['r']['nama']}\n   {rupiah(o['r']['nominal'])} · order {o['id']} ({o['pemesan']})\n"
             f"   Tiket: {', '.join(o['tiket'] or [])}\n   Dibayar {tgl(o['paid'], jam=True)}"
             + (f"\n   Data tidak sesuai menurut pemesan: {o['r']['data'].replace(chr(10), '; ')}" if o['r'].get('data') else "") for i, o in enumerate(antre, 1)]
    pesan, kini = [], kepala
    for b in butir + [f"Unggah bukti transfer di {SITE}/kuweraadmin/refund"]:
        if len(kini) + len(b) > 1800:  # batas pesan Discord 2000 huruf
            pesan.append(kini); kini = b
        else:
            kini += "\n\n" + b
    pesan.append(kini)
    env = dict(l.strip().split("=", 1) for l in open(T.BOT_ENV) if "=" in l and not l.startswith("#"))
    h = {"Authorization": "Bot " + env["DISCORD_BOT_TOKEN"].strip('"'), "User-Agent": "DiscordBot (dpro-ops, 1.0)", "Content-Type": "application/json"}
    pos = lambda url, data: json.loads(urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(data).encode(), headers=h), timeout=30).read())
    dm = pos("https://discord.com/api/v10/users/@me/channels", {"recipient_id": SUPERADMIN})["id"]
    for p in pesan:
        pos(f"https://discord.com/api/v10/channels/{dm}/messages", {"content": p, "allowed_mentions": {"users": [SUPERADMIN]}, "flags": 4})
        time.sleep(1)
    print("rekap terkirim ke DM superadmin,", len(antre), "menunggu transfer")


def main():
    a = sys.argv[1:]
    cfg = db("""select coalesce((select value from "Setting" where key = 'refund'), '{}')""")
    if not cfg.get("aktif") or not cfg.get("kunci"):
        return print("refund belum aktif") if a else None
    semua = db(SQL)
    belum = [o for o in semua if o["status"] == "PAID" and not o["r"]]
    if "--uji" in a:
        return print("contoh terkirim ke", a[a.index("--uji") + 1], kirim(T.akses(), a[a.index("--uji") + 1], *isi_umum(cfg, semua[0])))
    if "--rekap" in a:
        return rekap(semua, cfg)
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    s = json.load(open(STATE)) if os.path.exists(STATE) else {}
    for k in ("umum", "tautan", "status", "ingat"):
        s.setdefault(k, {})

    # Antrean email putaran ini: (kelompok catatan, kunci, nilai, order, pembuat isi, perlu lampiran)
    antre = []
    if "--umumkan" in a:
        antre = [("umum", o["id"], int(time.time()), o, isi_umum, False) for o in belum if o["id"] not in s["umum"]]
        if "--kering" in a:
            return print(len(antre), "pemesan akan dikirimi pengumuman:", " ".join(x[1] for x in antre))
    else:
        antre += [("tautan", o["id"], o["minta"], o, isi_tautan, False) for o in semua if o["minta"] and s["tautan"].get(o["id"]) != o["minta"]]
        for o in semua:
            if o["r"]:
                cap = f"{o['r']['status']}|{o['r']['ubah']}"
                if s["status"].get(o["id"]) != cap:
                    antre.append(("status", o["id"], cap, o, isi_status, o["r"]["status"] == "SELESAI"))
        # Pengingat hanya berjalan setelah pengumuman pernah dikirim, dan hanya ke yang menerima pengumuman itu.
        if cfg.get("diumumkan") and s["umum"]:
            hari = (datetime.now(timezone.utc).replace(tzinfo=None) - datetime.fromisoformat(cfg["diumumkan"].replace("Z", ""))).days
            for n in INGAT:
                if hari >= n:
                    antre += [("ingat", f"{o['id']}|{n}", int(time.time()), o, lambda c, x: isi_umum(c, x, ingat=True), False)
                              for o in belum if o["id"] in s["umum"] and f"{o['id']}|{n}" not in s["ingat"]
                              and not any(f"{o['id']}|{m}" in s["ingat"] and time.time() - s["ingat"][f"{o['id']}|{m}"] < 86400 for m in INGAT)]
    token, ada_baru = None, False
    for kelompok, kunci, nilai, o, pembuat, lampir in antre[:MAKS]:
        try:
            token = token or T.akses()
            judul, teks = pembuat(cfg, o)
            kirim(token, o["email"], judul, teks, bukti(o["id"]) if lampir else None)
            s[kelompok][kunci] = nilai
            json.dump(s, open(STATE, "w"))
            ada_baru = ada_baru or (kelompok == "status" and o["r"]["status"] == "DIAJUKAN")
            print("terkirim", kelompok, kunci)
        except Exception as e:  # satu alamat gagal tidak menghentikan yang lain; dicoba lagi di putaran berikutnya
            print("GAGAL", kelompok, kunci, e)
        time.sleep(3)
    if ada_baru:
        try:
            rekap(semua, cfg)
        except Exception as e:
            print("GAGAL rekap", e)


if __name__ == "__main__":
    main()
