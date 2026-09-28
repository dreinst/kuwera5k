"""KUWERA 5K tools for Hermes: superadmin menyetujui pembayaran QRIS manual dari Telegram.

Semua aksi dijalankan oleh cli.js di container kuwera-wa-bot (repo dreinst/kuwera5k, folder wa-bot/),
yang juga mengirim e-ticket ke WhatsApp pemesan setelah order disetujui. Dikunci per Telegram id di
gatekeeper (roles.USER_LOCKED_TOOLS).
"""
import json
import subprocess

CONTAINER = "kuwera-wa-bot"
NAMES = {"1769749405": "andrew", "705153966": "donny"}


def _who(kwargs):
    sid = kwargs.get("session_id") or kwargs.get("task_id") or ""
    try:
        from gatekeeper import store  # plugin gatekeeper sudah memetakan sesi ke Telegram id
        tg = store.get_session_sender(sid) if sid else None
    except Exception:
        tg = None
    return NAMES.get(str(tg), f"telegram {tg}" if tg else "superadmin")


def _cli(*argv):
    try:
        res = subprocess.run(["docker", "exec", CONTAINER, "node", "cli.js", *argv],
                             capture_output=True, text=True, timeout=60)
    except Exception as e:
        return json.dumps({"ok": False, "pesan": f"Bot KUWERA tidak bisa dijalankan: {e}"}, ensure_ascii=False)
    out = (res.stdout or "").strip().splitlines()
    return out[-1] if out else json.dumps({"ok": False, "pesan": (res.stderr or "tidak ada keluaran").strip()[-300:]}, ensure_ascii=False)


def kuwera_menunggu(args, **kwargs):
    return _cli("menunggu")


def kuwera_pemasukan(args, **kwargs):
    return _cli("pemasukan")


def kuwera_setujui(args, **kwargs):
    return _cli("setujui", str(args.get("order_id", "")).strip(), _who(kwargs))


def kuwera_tolak(args, **kwargs):
    return _cli("tolak", str(args.get("order_id", "")).strip(), _who(kwargs), str(args.get("alasan", "")).strip())


_ORDER = {"type": "string", "description": "nomor order persis, format KWR-2026-XXXXXX"}

MENUNGGU_SCHEMA = {
    "name": "kuwera_menunggu",
    "description": ("Daftar order KUWERA 5K (fun run) yang menunggu konfirmasi bayar QRIS manual, 3 hari terakhir: nomor order, "
                    "pemesan, jumlah tiket, nominal yang harus masuk, dan apakah pemesan sudah konfirmasi lewat WhatsApp. "
                    "Pakai ini kalau superadmin bilang 'setuju' tanpa menyebut nomor order, lalu tanyakan order yang mana."),
    "parameters": {"type": "object", "properties": {}, "required": []}}

SETUJUI_SCHEMA = {
    "name": "kuwera_setujui",
    "description": ("Setujui pembayaran QRIS manual satu order KUWERA 5K setelah superadmin memastikan uangnya masuk di GoPay "
                    "Merchant dengan nominal persis. Menandai lunas, menerbitkan e-ticket, dan bot mengirim tautan e-ticket ke "
                    "WhatsApp pemesan. Panggil kalau superadmin jelas menyetujui order itu: menulis 'setujui KWR-2026-ABC123', atau "
                    "me-reply foto bukti bayar KUWERA (konteks reply berisi 'KUWERA 5K: bukti bayar order KWR-...') dengan kata "
                    "persetujuan seperti ok, oke, acc, setuju, sip, lunas, atau ✅. Untuk reply, ambil nomor order dari teks yang "
                    "di-reply itu, bukan dari pesan lain. Jangan pernah menebak nomor order."),
    "parameters": {"type": "object", "properties": {"order_id": _ORDER}, "required": ["order_id"]}}

TOLAK_SCHEMA = {
    "name": "kuwera_tolak",
    "description": ("Beri tahu pemesan KUWERA 5K lewat WhatsApp bahwa pembayaran order-nya belum ditemukan, dengan alasan dari "
                    "superadmin. Order tetap menunggu, jadi masih bisa disetujui nanti. Juga dipakai kalau superadmin me-reply foto "
                    "bukti bayar KUWERA dengan 'tolak <alasan>'; nomor order diambil dari teks yang di-reply."),
    "parameters": {"type": "object", "properties": {
        "order_id": _ORDER,
        "alasan": {"type": "string", "description": "alasan singkat dari superadmin, maks 200 karakter (opsional)"}},
        "required": ["order_id"]}}

PEMASUKAN_SCHEMA = {
    "name": "kuwera_pemasukan",
    "description": "Total pemasukan KUWERA 5K yang sudah terverifikasi: jumlah pembelian, jumlah tiket, dan total rupiah. Hanya membaca.",
    "parameters": {"type": "object", "properties": {}, "required": []}}

_TOOLS = (
    ("kuwera_menunggu", MENUNGGU_SCHEMA, kuwera_menunggu, "⏳"),
    ("kuwera_setujui", SETUJUI_SCHEMA, kuwera_setujui, "✅"),
    ("kuwera_tolak", TOLAK_SCHEMA, kuwera_tolak, "❌"),
    ("kuwera_pemasukan", PEMASUKAN_SCHEMA, kuwera_pemasukan, "💰"),
)


def _container_up():
    try:
        r = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", CONTAINER], capture_output=True, text=True, timeout=10)
        return r.stdout.strip() == "true"
    except Exception:
        return False


def register(ctx):
    for name, schema, handler, emoji in _TOOLS:
        ctx.register_tool(name=name, toolset="kuwera", schema=schema, handler=handler,
                          check_fn=_container_up, description=schema["description"], emoji=emoji)
