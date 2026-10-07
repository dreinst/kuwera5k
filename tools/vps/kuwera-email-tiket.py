#!/usr/bin/env python3
"""Pengganti bot WhatsApp KUWERA selama nomor WhatsApp dibatasi. Tiga tugas tiap menit:
1. Kirim e-ticket lewat email ke pemesan yang ordernya lunas.
2. Teruskan bukti bayar yang diunggah di halaman /bayar ke Discord #chatbot dengan tombol Setujui dan Tolak.
3. Kirim pesan penolakan (dari tombol Tolak) lewat email ke pemesan.

Dipasang di VPS dreinst sebagai /usr/local/bin/kuwera-email-tiket, dijalankan timer systemd tiap menit.
Order yang sudah dikirimi dicatat di /var/lib/kuwera-email/terkirim.json, jadi setiap order hanya menerima satu email.
Pengirim: dproductioncare@gmail.com lewat Gmail API (token OAuth khusus kirim di /root/dpro-blast, hanya dibaca).

  kuwera-email-tiket            kirim ke semua order lunas yang belum dikirimi
  kuwera-email-tiket --kering   tampilkan yang akan dikirim, tanpa mengirim
  kuwera-email-tiket --uji A    kirim contoh (order lunas terbaru) ke alamat A, tanpa mencatat
  kuwera-email-tiket --html     cetak HTML contoh ke stdout
"""
import base64, glob, html, json, os, subprocess, sys, time, urllib.parse, urllib.request, uuid
from email.message import EmailMessage
from email.utils import formataddr

TOKEN = "/root/dpro-blast/google_token_blast.json"
STATE = "/var/lib/kuwera-email/terkirim.json"
DB = ["docker", "exec", "uvx3zbwvek7pig9oiwyzgivg", "psql", "-U", "kuwera", "-d", "kuwera5k", "-At", "-c"]
SITE = "https://kuwera5k.vercel.app"
DARI = ("KUWERA Fun Run 5K", "dproductioncare@gmail.com")
WA_BANTUAN = "0822-2855-5254"
RACE_PACK = "Kamis dan Jumat, 22 dan 23 Oktober 2026 di Kudam V/Brawijaya"
RACE_DAY = "Sabtu, 24 Oktober 2026, 06.00 WIB di Lapangan Rampal"
MAKS = 40  # batas kiriman per putaran
STATE_BUKTI = "/var/lib/kuwera-email/bukti.json"
BOT_ENV = "/root/kuwera-wa-bot/.env"  # token bot Ops dan kanal #chatbot, sama dengan yang dipakai bot WhatsApp
OUTBOX = "/root/kuwera-wa-bot/data/outbox"
OUTBOX_SELESAI = "/root/kuwera-wa-bot/data/outbox-ditahan/email-terkirim"

SQL = """select coalesce(json_agg(x order by x.paid), '[]') from (
  select o.id, o.total, o.quantity, o."buyerEmail" as email, o."paidAt" as paid,
         (select p."fullName" from "Participant" p where p."orderId" = o.id order by p.position limit 1) as pemesan,
         (select json_agg(json_build_object('nama', p."fullName", 'kode', t.code) order by p.position)
            from "Ticket" t join "Participant" p on p.id = t."participantId" where t."orderId" = o.id) as tiket
    from "Order" o
   where o.status = 'PAID' and not o."isTest" and o."buyerEmail" like '%@%'
     and exists (select 1 from "Ticket" t where t."orderId" = o.id)) x"""


def db(sql):
    return json.loads(subprocess.run(DB + [sql], capture_output=True, text=True, check=True).stdout)


def orders():
    return db(SQL)


def rupiah(n):
    return "Rp" + f"{int(n):,}".replace(",", ".")


def isi(o):
    nama = (o["pemesan"] or "Kak").split(" ")[0]
    link = f"{SITE}/tiket/{o['id']}"
    tiket = o["tiket"] or []
    teks = "\n".join([
        f"Halo Kak {nama},",
        "",
        f"Pembayaran order {o['id']} sebesar {rupiah(o['total'])} sudah kami terima. Terima kasih sudah mendaftar KUWERA Fun Run 5K!",
        "",
        "Kode QR registrasi ulang (ditunjukkan saat mengambil race pack):",
        *[f"{i}. {t['nama']}: {t['kode']}" for i, t in enumerate(tiket, 1)],
        "",
        f"E-ticket lengkap beserta QR: {link}",
        "",
        f"Race pack bisa diambil pada {RACE_PACK}. Jam pengambilannya kami kabarkan menjelang hari H. Mohon bawa KTP atau KIA asli setiap peserta, ya.",
        f"Hari lomba: {RACE_DAY}.",
        "",
        "Nomor WhatsApp kantor kami sedang tidak aktif, jadi e-ticket dan kabar berikutnya kami kirim lewat email ini. "
        f"Kalau ada kendala, Kakak bisa chat panitia di WhatsApp {WA_BANTUAN} atau membalas email ini.",
        "",
        "Sampai jumpa di garis start!",
        "Panitia KUWERA Fun Run 5K",
    ])
    e = html.escape
    baris = "".join(
        f'<tr><td style="padding:8px 12px;border-bottom:1px solid #e3ebe5;color:#1a1a1a">{e(t["nama"])}</td>'
        f'<td style="padding:8px 12px;border-bottom:1px solid #e3ebe5;color:#0b4a2c;font-family:monospace;font-weight:bold">{e(t["kode"])}</td></tr>'
        for t in tiket)
    halaman = f"""<div style="background:#f2f5f3;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden">
<div style="background:#0b4a2c;padding:22px 24px"><div style="color:#ffffff;font-size:20px;font-weight:bold">KUWERA Fun Run 5K</div>
<div style="color:#f4e71d;font-size:14px;margin-top:4px">E-ticket order {e(o['id'])}</div></div>
<div style="padding:24px;color:#1a1a1a;font-size:15px;line-height:1.6">
<p style="margin:0 0 12px">Halo Kak {e(nama)},</p>
<p style="margin:0 0 16px">Pembayaran order <b>{e(o['id'])}</b> sebesar <b>{rupiah(o['total'])}</b> sudah kami terima. Terima kasih sudah mendaftar KUWERA Fun Run 5K!</p>
<p style="margin:0 0 8px">Kode QR registrasi ulang, ditunjukkan saat mengambil race pack:</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px">{baris}</table>
<p style="margin:0 0 20px;text-align:center"><a href="{link}" style="display:inline-block;background:#0b4a2c;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:999px">Buka e-ticket dan QR</a></p>
<p style="margin:0 0 12px">Race pack bisa diambil pada <b>{RACE_PACK}</b>. Jam pengambilannya kami kabarkan menjelang hari H. Mohon bawa KTP atau KIA asli setiap peserta, ya.</p>
<p style="margin:0 0 16px">Hari lomba: <b>{RACE_DAY}</b>.</p>
<p style="margin:0 0 16px;background:#f2f5f3;border-radius:10px;padding:12px 14px;font-size:14px;color:#1a1a1a">Nomor WhatsApp kantor kami sedang tidak aktif, jadi e-ticket dan kabar berikutnya kami kirim lewat email ini. Kalau ada kendala, Kakak bisa chat panitia di WhatsApp {WA_BANTUAN} atau membalas email ini.</p>
<p style="margin:0">Sampai jumpa di garis start!<br>Panitia KUWERA Fun Run 5K</p>
</div></div></div>"""
    return teks, halaman


def akses():
    t = json.load(open(TOKEN))
    data = urllib.parse.urlencode({"client_id": t["client_id"], "client_secret": t["client_secret"],
                                   "refresh_token": t["refresh_token"], "grant_type": "refresh_token"}).encode()
    return json.loads(urllib.request.urlopen(urllib.request.Request(t["token_uri"], data=data), timeout=30).read())["access_token"]


def kirim(token, tujuan, o, judul=None, teks=None):
    halaman = None
    if teks is None:
        teks, halaman = isi(o)
    m = EmailMessage()
    m["From"] = formataddr(DARI)
    m["To"] = tujuan
    m["Subject"] = judul or f"E-ticket KUWERA Fun Run 5K (order {o['id']})"
    m.set_content(teks)
    if halaman:
        m.add_alternative(halaman, subtype="html")
    body = json.dumps({"raw": base64.urlsafe_b64encode(m.as_bytes()).decode()}).encode()
    req = urllib.request.Request("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", data=body,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())["id"]


def bukti_web():
    """Bukti bayar yang diunggah di /bayar: kartu invoice dan gambar bukti ke Discord, dengan tombol Setujui dan Tolak."""
    sudah = json.load(open(STATE_BUKTI)) if os.path.exists(STATE_BUKTI) else {}
    baru = [b for b in db("""select coalesce(json_agg(json_build_object('id', f.id, 'order', f."orderId") order by f."createdAt"), '[]')
        from "PaymentProof" f join "Order" o on o.id = f."orderId"
       where f.source = 'web' and not o."isTest" and o.status <> 'PAID' and f."createdAt" > timezone('UTC', now()) - interval '3 days'""") if b["id"] not in sudah]
    if not baru:
        return
    env = dict(l.strip().split("=", 1) for l in open(BOT_ENV) if "=" in l and not l.startswith("#"))
    kepala = {"Authorization": "Bot " + env["DISCORD_BOT_TOKEN"].strip('"'), "User-Agent": "DiscordBot (dpro-ops, 1.0)"}
    for b in baru[:10]:
        try:
            d = db(f"""select json_build_object('nama', f."fileName", 'data', encode(f.data, 'base64'), 'status', o.status, 'total', o.total,
                 'tiket', o.quantity, 'lewat', o.status <> 'PENDING' or o."expiresAt" < timezone('UTC', now()),
                 'pemesan', (select p."fullName" from "Participant" p where p."orderId" = o.id order by p.position limit 1))
                 from "PaymentProof" f join "Order" o on o.id = f."orderId" where f.id = '{b["id"]}'""")
            oid = b["order"]
            files = [(f"{oid}-{d['nama']}", base64.b64decode(d["data"]))]
            if d["status"] == "PENDING":
                try:
                    files.insert(0, (f"invoice-{oid}.png", urllib.request.urlopen(f"{SITE}/api/orders/{oid}/qris", timeout=30).read()))
                except Exception:
                    pass  # kartu invoice hanya pelengkap
            teks = "\n".join([
                f"KUWERA 5K: bukti bayar order {oid}{' (waktu bayar sudah habis)' if d['lewat'] else ''}",
                f"Pemesan: {d['pemesan'] or '-'}, {d['tiket']} tiket",
                f"Nominal yang harus masuk: {rupiah(d['total'])}",
                "",
                "Bukti diunggah pemesan di halaman pembayaran. Cek riwayat GoPay Merchant. Kalau nominalnya persis masuk, klik Setujui. Kalau belum ada, klik Tolak lalu isi alasannya.",
                "Setelah disetujui e-ticket dikirim ke email pemesan. Pesan penolakan juga dikirim lewat email.",
                f"Bisa juga lewat {SITE}/kuweraadmin/peserta/{oid}",
            ])
            payload = {"content": teks, "allowed_mentions": {"parse": []},
                       "attachments": [{"id": i, "filename": n} for i, (n, _) in enumerate(files)],
                       "components": [{"type": 1, "components": [
                           {"type": 2, "style": 3, "label": "Setujui", "emoji": {"name": "\u2705"}, "custom_id": f"kuwera:setujui:{oid}"},
                           {"type": 2, "style": 4, "label": "Tolak", "emoji": {"name": "\u274c"}, "custom_id": f"kuwera:tolak:{oid}"}]}]}
            batas = uuid.uuid4().hex
            body = f'--{batas}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n'.encode() + json.dumps(payload).encode() + b"\r\n"
            for i, (n, isi_file) in enumerate(files):
                body += f'--{batas}\r\nContent-Disposition: form-data; name="files[{i}]"; filename="{n}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + isi_file + b"\r\n"
            body += f"--{batas}--\r\n".encode()
            req = urllib.request.Request(f"https://discord.com/api/v10/channels/{env['DISCORD_CHANNEL_ID'].strip(chr(34))}/messages", data=body,
                                         headers={**kepala, "Content-Type": f"multipart/form-data; boundary={batas}"})
            sudah[b["id"]] = {"t": int(time.time()), "pesan": json.loads(urllib.request.urlopen(req, timeout=30).read())["id"]}
            json.dump(sudah, open(STATE_BUKTI, "w"))
            print("bukti diteruskan", oid)
        except Exception as e:
            print("GAGAL bukti", b["order"], e)


def tolak_email():
    """Pesan penolakan dari tombol Tolak menunggu di outbox bot (orderId tanpa jid). Bot WhatsApp sedang tidak tertaut,
    jadi pesannya dikirim lewat email, lalu filenya dipindah supaya tidak terkirim dua kali."""
    token = None
    for f in sorted(glob.glob(OUTBOX + "/*.json")):
        try:
            item = json.load(open(f))
            if item.get("jid") or not item.get("orderId") or not item.get("text"):
                continue
            oid = item["orderId"]
            o = db(f"""select json_build_object('id', o.id, 'email', o."buyerEmail") from "Order" o where o.id = '{oid}'""") if oid.replace("-", "").isalnum() else None
            if not o or "@" not in (o["email"] or ""):
                continue
            teks = item["text"].replace("bisa dikirim ulang di chat ini, ya.", f"bisa diunggah ulang di halaman pembayaran: {SITE}/bayar/{oid}")
            teks += f"\n\nKalau ada kendala, Kakak bisa chat panitia di WhatsApp {WA_BANTUAN} atau membalas email ini.\n\nPanitia KUWERA Fun Run 5K"
            token = token or akses()
            kirim(token, o["email"], o, judul=f"Pembayaran order {oid} belum kami temukan", teks=teks)
            os.makedirs(OUTBOX_SELESAI, exist_ok=True)
            os.rename(f, os.path.join(OUTBOX_SELESAI, os.path.basename(f)))
            print("penolakan terkirim", oid)
        except Exception as e:
            print("GAGAL penolakan", f, e)


def main():
    a = sys.argv[1:]
    semua = orders()
    if "--html" in a:
        return print(isi(semua[-1])[1])
    if "--uji" in a:
        o = semua[-1]
        return print("contoh", o["id"], "terkirim ke", a[a.index("--uji") + 1], kirim(akses(), a[a.index("--uji") + 1], o))
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    sudah = json.load(open(STATE)) if os.path.exists(STATE) else {}
    antre = [o for o in semua if o["id"] not in sudah][:MAKS]
    if "--kering" in a:
        return print(len(antre), "order akan dikirimi:", " ".join(o["id"] for o in antre))
    for tugas in (bukti_web, tolak_email):
        try:
            tugas()
        except Exception as e:
            print("GAGAL", tugas.__name__, e)
    if not antre:
        return
    token = akses()
    for o in antre:
        try:
            sudah[o["id"]] = {"t": int(time.time()), "id": kirim(token, o["email"], o)}
            json.dump(sudah, open(STATE, "w"))
            print("terkirim", o["id"])
        except Exception as e:  # satu alamat gagal tidak menghentikan yang lain; dicoba lagi di putaran berikutnya
            print("GAGAL", o["id"], e)
        time.sleep(3)


if __name__ == "__main__":
    main()
