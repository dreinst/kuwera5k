"""KUWERA 5K tools for Hermes: superadmin menyetujui pembayaran QRIS manual dari Telegram.

Semua aksi dijalankan oleh cli.js di container kuwera-wa-bot (repo dreinst/kuwera5k, folder wa-bot/),
yang juga mengirim e-ticket ke WhatsApp pemesan setelah order disetujui. Dikunci per Telegram id di
gatekeeper (roles.USER_LOCKED_TOOLS).
"""
import json
import re
import subprocess
import threading
import urllib.request

CONTAINER = "kuwera-wa-bot"
BOT_DIR = "/root/kuwera-wa-bot"
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


# --- Persetujuan tanpa AI -------------------------------------------------------------------------
# Pesan superadmin di Telegram dicegat sebelum sampai ke agen (hook pre_gateway_dispatch), supaya "ok" tidak
# ditafsirkan macam-macam. Order diambil dari foto bukti yang di-reply; kalau tidak me-reply dan hanya ada
# satu bukti yang menunggu, order itu yang dipakai. Daftar bukti yang menunggu ditulis bot WA ke
# data/telegram-bukti.json dan dihapus setelah order lunas.
_OK = {"ok", "oke", "okay", "okey", "acc", "setuju", "setujui", "sip", "lunas", "ya", "y", "✅", "👍", "👌"}
_ORDER_RE = re.compile(r"KWR-\d{4}-[A-Z0-9]{6}", re.I)


def _waiting():
    try:
        with open(f"{BOT_DIR}/data/telegram-bukti.json", encoding="utf-8") as f:
            return list(json.load(f).keys())
    except Exception:
        return []


def _bot_env(key):
    try:
        with open(f"{BOT_DIR}/.env", encoding="utf-8") as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


def _send(chat_id, text, reply_to=None):
    token = _bot_env("TELEGRAM_BOT_TOKEN")
    if not token:
        return
    body = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if reply_to:
        body["reply_parameters"] = {"message_id": int(reply_to), "allow_sending_without_reply": True}
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=15).read()
    except Exception:
        pass


def _decide(text, reply_text):
    """(aksi, order, alasan) atau None kalau pesan ini bukan urusan KUWERA."""
    # Hermes menempelkan catatan "[Replied-to image ...]" ke teks kalau yang di-reply berupa foto.
    words = re.sub(r"\s*\[Replied-to .*$", "", text, flags=re.S).strip()
    low = words.lower().strip(" .!")
    explicit = _ORDER_RE.search(words)
    ours = "KUWERA 5K" in reply_text or reply_text.startswith("Invoice yang dikirim ke pemesan")
    replied = _ORDER_RE.search(reply_text) if ours else None
    if low.startswith("setujui") and explicit:
        return ("setujui", explicit.group(0).upper(), "")
    if low.startswith("tolak") and explicit:
        return ("tolak", explicit.group(0).upper(), _ORDER_RE.sub("", words[5:]).strip())
    is_ok = low in _OK
    is_tolak = low == "tolak" or low.startswith("tolak ")
    if not (is_ok or is_tolak):
        return None
    alasan = words[5:].strip() if is_tolak else ""
    if replied:
        return ("setujui" if is_ok else "tolak", replied.group(0).upper(), alasan)
    if reply_text:
        return None  # reply ke pesan lain, bukan foto bukti KUWERA
    waiting = _waiting()
    if len(waiting) == 1:
        return ("setujui" if is_ok else "tolak", waiting[0], alasan)
    if len(waiting) > 1:
        return ("pilih", ", ".join(waiting), "")
    return None


def _run(chat_id, msg_id, who, action, order, alasan):
    if action == "pilih":
        try:
            names = {r["id"]: r.get("pemesan") or "-" for r in json.loads(_cli("menunggu"))}
        except Exception:
            names = {}
        rows = "\n".join(f"- {o} ({names.get(o, '-')})" for o in order.split(", "))
        _send(chat_id, f"Ada beberapa bukti bayar yang menunggu:\n{rows}\nReply foto bukti yang mau disetujui dengan: ok", msg_id)
        return
    try:
        res = json.loads(_cli(action, order, who, *([alasan] if action == "tolak" else [])))
    except Exception as e:
        res = {"ok": False, "pesan": str(e)[:200]}
    if action == "setujui":
        text = (f"✅ Order {order} atas nama {res.get('pemesan', '-')} disetujui. E-ticket dikirim ke WhatsApp pemesan dalam sekitar 20 detik."
                if res.get("ok") else f"Order {order} tidak disetujui: {res.get('pesan', 'gagal')}")
    else:
        text = (f"❌ Penolakan order {order} atas nama {res.get('pemesan', '-')} diteruskan ke WhatsApp pemesan. Order tetap menunggu."
                if res.get("ok") else f"Penolakan order {order} gagal: {res.get('pesan', 'gagal')}")
    _send(chat_id, text, msg_id)


def pre_gateway_dispatch(event, gateway=None, session_store=None, **kwargs):
    src = getattr(event, "source", None)
    platform = getattr(getattr(src, "platform", None), "value", None) or str(getattr(src, "platform", ""))
    if "telegram" not in str(platform).lower():
        return None
    tg = str(getattr(src, "user_id", "") or "")
    if tg not in NAMES:
        return None
    decision = _decide(getattr(event, "text", "") or "", getattr(event, "reply_to_text", "") or "")
    if not decision:
        return None
    action, order, alasan = decision
    chat_id = str(getattr(src, "chat_id", "") or tg)
    threading.Thread(target=_run, args=(chat_id, getattr(event, "message_id", None), NAMES[tg], action, order, alasan),
                     daemon=True).start()
    return {"action": "skip", "reason": f"kuwera {action} {order}"}


def register(ctx):
    ctx.register_hook("pre_gateway_dispatch", pre_gateway_dispatch)
    for name, schema, handler, emoji in _TOOLS:
        ctx.register_tool(name=name, toolset="kuwera", schema=schema, handler=handler,
                          check_fn=_container_up, description=schema["description"], emoji=emoji)
