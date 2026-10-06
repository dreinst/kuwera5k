// Bot WhatsApp KUWERA 5K untuk bayar manual QRIS. Bayar manual DriveTech (kode booking BK-...) juga lewat bot ini,
// lihat drivetech.js.
//
// 1. Pemesan menekan "Minta QRIS via WhatsApp" di /bayar dan mengirim pesan berisi nomor order ke nomor
//    kantor. Bot membalas dengan kartu bayar (QRIS dinamis bernominal total, dari /api/orders/{id}/qris).
//    Setelah pemesan mengirim screenshot bukti bayar, bot meneruskan kartu invoice yang sama dengan milik pemesan
//    plus foto bukti bayarnya ke Discord #chatbot (superadmin), dengan tombol Setujui/Tolak yang ditangani bot
//    D'Pro Ops di VPS lewat cli.js. Kalau Discord gagal, jatuh ke Telegram superadmin (@dproagentbot) seperti dulu:
//    keterangan foto bukti memuat nomor order, jadi superadmin cukup me-reply foto itu dengan "ok".
// 2. Superadmin me-reply foto bukti dengan "ok" atau menulis "setujui KWR-..." ke Hermes (tool kuwera_setujui,
//    lihat hermes-plugin/), atau admin menandai lunas di /kuweraadmin. Keduanya mengubah order yang sama di database,
//    dan kabar "terverifikasi" dikirim sebagai reply ke foto bukti di Telegram, dari jalur mana pun. Setelah order lunas, bot mengirim tautan e-ticket ke WhatsApp pemesan
//    dan mengabari superadmin total pemasukan KUWERA yang sudah terverifikasi.
// 3. "tolak KWR-... alasan" (tool kuwera_tolak) menaruh pesan di /data/outbox; bot mengirimkannya ke pemesan.
//
// Bot hanya menghubungi pemesan yang sudah chat lebih dulu, jadi tidak ada pesan massal. Nomor kantor yang
// sama juga dipakai bot Pet Blessing dan Hermes sebagai perangkat tertaut lain; keduanya tidak membalas
// chat berisi nomor order, jadi tidak bentrok.

const fs = require('node:fs');
const crypto = require('node:crypto');
const { makeWahaSock, BufferJSON } = require('./waha-sock');
const { Pool } = require('pg');
const pino = require('pino');
const QRCode = require('qrcode');

const logger = pino({ level: 'info' });
const SITE_URL = (process.env.SITE_URL || 'https://kuwera5k.vercel.app').replace(/\/$/, '');
const PAIRING_PHONE = (process.env.PAIRING_PHONE || '').replace(/\D/g, '');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';
const DC_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const DC_CHANNEL = process.env.DISCORD_CHANNEL_ID || '';
const REAL_GATEWAYS = ['qris-manual', 'midtrans'];
const ORDER_RE = /KWR-\d{4}-[A-Z0-9]{6}/i;
const CONFIRM_FILE = '/data/konfirmasi.json';
const OUTBOX = '/data/outbox';
const PROOF_FILE = '/data/telegram-bukti.json'; // order -> id pesan bukti (angka = Telegram, teks = Discord)
// Layanan pelanggan: semua chat pribadi ke nomor kantor (di luar alur bukti bayar) ditaruh di INBOX untuk worker CS
// (bot D'Pro Ops di VPS: Kimi, cadangan Claude). Worker yang memilah konteksnya; balasan kembali lewat OUTBOX (field jid).
const INBOX = '/data/inbox';
// Nama kontak yang tersimpan di HP kantor (sinkron app state WhatsApp), dikunci dengan digit nomor atau LID.
const CONTACTS_FILE = '/data/contacts.json';
let contacts = {};
try { contacts = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8')); } catch { contacts = {}; }
const digits = (id) => String(id || '').replace(/@.*/, '').replace(/:.*/, '').replace(/\D/g, '');
function rememberContacts(list) {
  let changed = false;
  for (const c of list) {
    if (!c.name) continue;
    for (const key of [c.id, c.lid, c.phoneNumber].map(digits).filter(Boolean)) {
      if (contacts[key] !== c.name) { contacts[key] = c.name; changed = true; }
    }
  }
  if (changed) fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts));
}
// ID pesan yang dikirim bot ini, supaya worker CS bisa membedakan balasan bot dari balasan admin (HP atau WhatsApp Web
// sama-sama ber-ID "3EB0...", jadi format ID tidak bisa dipakai).
const SENT_IDS = '/data/sent-ids.txt';
// Arsip per order (bukti bayar, invoice, info.json) plus riwayat.csv; disalin ke NAS oleh kuwera-arsip-nas di VPS.
const ARCHIVE = '/data/arsip';
// Jam operasional (aturan PRD optimasi 4.12): pukul JAM_TUTUP sampai JAM_BUKA WIB pesan pribadi tidak diproses.
// Pesan disimpan di TUNDA (media ikut diunduh saat itu juga) dan setiap chat mendapat satu kabar singkat; mulai
// JAM_BUKA semua pesan diproses berurutan seperti baru masuk. Order yang tenggat bayarnya jatuh di jam tutup
// diperpanjang sampai JAM_BUKA + PERPANJANG_MENIT, jadi tidak ada order yang hangus karena menunggu jawaban.
// Jendela perawatan server (restart, deploy) jatuh di dalam jam tutup, pukul 02.00 WIB.
const JAM_TUTUP = Number(process.env.JAM_TUTUP ?? 1);
const JAM_BUKA = Number(process.env.JAM_BUKA ?? 6);
const PERPANJANG_MENIT = 180;
const TUNDA = '/data/tunda';
// Sama dengan src/lib/event-data.ts (racePackDates, racePackPlace, racePackHours, jadwal acara).
const RACE_PACK = 'Kamis dan Jumat, 22 dan 23 Oktober 2026 di Kudam V/Brawijaya';
const RACE_DAY = 'Sabtu, 24 Oktober 2026, 06.00 WIB di Lapangan Rampal';
// Mode nomor pribadi (PRIBADI=1): nomor kantor sedang dibatasi WhatsApp, jadi bot sementara tertaut ke nomor pribadi
// superadmin dengan sesi login sendiri (AUTH_DIR). Bot hanya menyentuh chat pembeli KUWERA (nomor order, kata KUWERA,
// atau nomor HP pembeli/peserta) dan hanya mengirim ke chat yang sudah lebih dulu menghubungi nomor ini, plus nomor di
// PRIBADI_IZIN (misalnya brief pagi owner). Kiriman lain di outbox (blast, grup, pengingat) ditahan di OUTBOX_TAHAN.
// Data, arsip, dan log tetap di tempat yang sama dengan mode kantor.
const PRIBADI = process.env.PRIBADI === '1';
const AUTH_DIR = process.env.AUTH_DIR || '/data/auth';
const PRIBADI_IZIN = (process.env.PRIBADI_IZIN || '').split(',').map((x) => x.replace(/\D/g, '')).filter(Boolean);
// Grup yang tetap dilayani saat mode pribadi (keputusan Donny 1 Okt: grup Documents Generator).
const PRIBADI_GRUP = (process.env.PRIBADI_GRUP || '').split(',').map((x) => x.trim()).filter(Boolean);
const PRIBADI_FILE = '/data/pribadi-chat.json'; // jid -> waktu pertama menghubungi nomor pribadi
const OUTBOX_TAHAN = '/data/outbox-ditahan';
const PRIBADI_INFO = process.env.PRIBADI_INFO || 'Halo Kak 🙏 Untuk sementara WhatsApp kantor D\'Production sedang gangguan, jadi layanan KUWERA 5K kami jalankan dari nomor ini dulu ya. Semua pendaftaran dan pembayaran tetap tercatat seperti biasa.';
let pribadiChat = {};
try { pribadiChat = JSON.parse(fs.readFileSync(PRIBADI_FILE, 'utf8')); } catch { pribadiChat = {}; }

const caFile = process.env.DB_SSL_CA_FILE;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  // Sertifikat Coolify memuat nama resource database, sama dengan host di DATABASE_URL.
  ssl: caFile ? { ca: fs.readFileSync(caFile, 'utf8'), rejectUnauthorized: true } : undefined,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const between = (a, b) => a + Math.floor(Math.random() * (b - a));
const rupiah = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
// Kolom timestamp Prisma disimpan tanpa zona waktu dalam UTC; container juga UTC, jadi Date-nya benar.
const wib = (d) => (d ? new Date(d).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '-');
const phoneJid = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const intl = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  return intl.length >= 10 ? intl + '@s.whatsapp.net' : null;
};

// Chat tempat pemesan mengirim konfirmasi, supaya tautan tiket juga dikirim ke sana kalau nomornya berbeda
// dengan nomor HP di form. Disimpan di volume supaya tidak hilang saat restart.
let confirmChats = {};
try { confirmChats = JSON.parse(fs.readFileSync(CONFIRM_FILE, 'utf8')); } catch { confirmChats = {}; }
const saveConfirmChats = () => fs.writeFileSync(CONFIRM_FILE, JSON.stringify(confirmChats));
// Order yang sudah dikirimi pengingat bayar (order -> waktu kirim), supaya pengingat hanya sekali per order.
const REMIND_FILE = '/data/pengingat.json';
let reminded = {};
try { reminded = JSON.parse(fs.readFileSync(REMIND_FILE, 'utf8')); } catch { reminded = {}; }
const REMIND_MINUTES = 60;
let proofMessages = {};
try { proofMessages = JSON.parse(fs.readFileSync(PROOF_FILE, 'utf8')); } catch { proofMessages = {}; }
const saveProofMessages = () => fs.writeFileSync(PROOF_FILE, JSON.stringify(proofMessages));

async function telegram(text, replyTo) {
  if (!TG_TOKEN || !TG_CHAT) return logger.warn('Telegram belum diatur, notifikasi dilewati');
  const extra = replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {};
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true, ...extra }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

// Kirim foto atau dokumen ke Telegram superadmin; mengembalikan message_id supaya bisa di-reply nanti.
async function telegramFile(kind, buffer, filename, caption) {
  if (!TG_TOKEN || !TG_CHAT) return logger.warn('Telegram belum diatur, notifikasi dilewati');
  const form = new FormData();
  form.append('chat_id', TG_CHAT);
  form.append('caption', caption);
  form.append(kind, new Blob([buffer]), filename);
  const method = kind === 'photo' ? 'sendPhoto' : 'sendDocument';
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  return (await res.json()).result.message_id;
}

// Kirim ke Discord #chatbot lewat bot D'Pro Ops. files: [{ buffer, name }]. approve: nomor order (atau kode booking
// DriveTech dengan approvePrefix 'drivetech') untuk tombol Setujui/Tolak. Mengembalikan id pesan (teks) supaya kabar
// lunas bisa dibalas ke pesan yang sama.
async function discord(content, { replyTo, files = [], approve, approvePrefix = 'kuwera' } = {}) {
  if (!DC_TOKEN || !DC_CHANNEL) throw new Error('Discord belum diatur');
  const payload = { content: content.slice(0, 1990), allowed_mentions: { parse: [] } };
  if (replyTo) payload.message_reference = { message_id: replyTo, fail_if_not_exists: false };
  if (approve) {
    payload.components = [{ type: 1, components: [
      { type: 2, style: 3, label: 'Setujui', emoji: { name: '✅' }, custom_id: `${approvePrefix}:setujui:${approve}` },
      { type: 2, style: 4, label: 'Tolak', emoji: { name: '❌' }, custom_id: `${approvePrefix}:tolak:${approve}` },
    ] }];
  }
  const form = new FormData();
  payload.attachments = files.map((f, i) => ({ id: i, filename: f.name }));
  form.append('payload_json', JSON.stringify(payload));
  files.forEach((f, i) => form.append(`files[${i}]`, new Blob([f.buffer]), f.name));
  const res = await fetch(`https://discord.com/api/v10/channels/${DC_CHANNEL}/messages`, {
    method: 'POST', headers: { Authorization: `Bot ${DC_TOKEN}` }, body: form, signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

// Kabar teks ke superadmin: Discord dulu, Telegram kalau Discord gagal. replyTo dari proofMessages.
async function notify(text, replyTo) {
  try {
    return await discord(text, { replyTo: typeof replyTo === 'string' ? replyTo : undefined });
  } catch (e) {
    logger.warn({ err: e.message }, 'Discord gagal, kirim ke Telegram');
    await telegram(text, typeof replyTo === 'number' ? replyTo : undefined);
    return null;
  }
}

const stampWib = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', '_').replace(/:/g, '');
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Unduh media sekali per pesan, dipakai arsip dan Telegram.
async function mediaOf(msg) {
  if (msg._media !== undefined) return msg._media;
  const doc = msg.message?.documentMessage;
  const kind = msg.message?.imageMessage ? 'photo' : doc ? 'document' : null;
  msg._media = null;
  if (kind) {
    try {
      const buffer = await sock.downloadMedia(msg);
      const name = kind === 'document' ? (doc.fileName || 'dokumen').replace(/[^\w.\- ]/g, '_') : 'bukti.jpg';
      const mime = (kind === 'document' ? doc.mimetype : msg.message.imageMessage.mimetype) || 'application/octet-stream';
      msg._media = { kind, buffer, name, mime };
    } catch (e) { logger.error({ err: e.message }, 'gagal mengunduh media'); }
  }
  return msg._media;
}

// Bukti bayar juga disimpan di database (tabel PaymentProof) supaya bisa dilihat dan diunduh di /kuweraadmin.
async function saveProof(orderId, media) {
  try {
    await pool.query(
      `INSERT INTO "PaymentProof" (id, "orderId", "fileName", "mimeType", data, source, "createdAt")
       SELECT $1, o.id, $3, $4, $5, 'whatsapp', timezone('UTC', now()) FROM "Order" o WHERE o.id = $2`,
      ['c' + crypto.randomBytes(12).toString('hex'), orderId, `${stampWib()}-${media.name}`, media.mime, media.buffer],
    );
  } catch (e) {
    logger.error({ orderId, err: e.message }, 'gagal menyimpan bukti bayar ke database');
  }
}

// Simpan kejadian satu order ke arsip: file (kalau ada), info.json terbaru, dan satu baris riwayat.csv.
// Kegagalan arsip tidak boleh menghentikan alur bayar, jadi errornya hanya dicatat.
async function archive(orderId, kejadian, file, dari) {
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.status, o.total, o.quantity, o."uniqueCode", o."buyerPhone", o."buyerEmail", o."createdAt", o."paidAt",
              (SELECT p."rawPayload"->>'verifiedBy' FROM "Payment" p WHERE p."orderId" = o.id ORDER BY p."receivedAt" DESC LIMIT 1) AS disetujui_oleh,
              (SELECT p."rawPayload"->>'via' FROM "Payment" p WHERE p."orderId" = o.id ORDER BY p."receivedAt" DESC LIMIT 1) AS lewat,
              (SELECT json_agg(json_build_object('urutan', p.position, 'nama', p."fullName", 'jersey', p."jerseySize", 'hp', p.phone, 'email', p.email,
                                                 'tiket', (SELECT t.code FROM "Ticket" t WHERE t."participantId" = p.id)) ORDER BY p.position)
                 FROM "Participant" p WHERE p."orderId" = o.id) AS peserta
         FROM "Order" o WHERE o.id = $1`,
      [orderId],
    );
    const o = rows[0];
    if (!o) return;
    const dir = `${ARCHIVE}/${o.id}`;
    fs.mkdirSync(dir, { recursive: true });
    const stamp = stampWib();
    const saved = file ? `${stamp}-${file.name}` : '';
    if (file) fs.writeFileSync(`${dir}/${saved}`, file.buffer);
    let events = [];
    try { events = JSON.parse(fs.readFileSync(`${dir}/info.json`, 'utf8')).riwayat || []; } catch { events = []; }
    events.push({ waktu: stamp, kejadian, file: saved || undefined, dari: dari || undefined });
    const peserta = o.peserta || [];
    fs.writeFileSync(`${dir}/info.json`, JSON.stringify({
      order: o.id, status: o.status, total: Number(o.total), kodeUnik: o.uniqueCode, jumlahTiket: o.quantity,
      pemesan: peserta[0]?.nama || '-', hpPemesan: o.buyerPhone, emailPemesan: o.buyerEmail,
      dibuat: o.createdAt, lunas: o.paidAt, disetujuiOleh: o.disetujui_oleh, lewat: o.lewat, peserta, riwayat: events,
    }, null, 2));
    const line = [stamp, o.id, kejadian, o.status, Number(o.total), peserta[0]?.nama || '-', peserta.map((p) => p.nama).join('; '), o.buyerPhone, dari || '', saved]
      .map(csv).join(',') + '\n';
    const index = `${ARCHIVE}/riwayat.csv`;
    if (!fs.existsSync(index)) fs.writeFileSync(index, 'waktu_wib,order,kejadian,status,total,pemesan,peserta,hp_pemesan,chat_wa,file\n');
    fs.appendFileSync(index, line);
  } catch (e) {
    logger.error({ orderId, kejadian, err: e.message }, 'gagal menulis arsip');
  }
}

async function loadOrder(id) {
  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.total, o.quantity, o."expiresAt", o."buyerPhone",
            (SELECT p."fullName" FROM "Participant" p WHERE p."orderId" = o.id ORDER BY p.position LIMIT 1) AS buyer
       FROM "Order" o WHERE o.id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function incomeSummary() {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS orders, coalesce(sum(o.quantity), 0)::int AS tickets, coalesce(sum(o.total), 0)::bigint AS total
       FROM "Order" o
      WHERE o.status = 'PAID' AND NOT o."isTest"
        AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."orderId" = o.id AND p.gateway = ANY($1))`,
    [REAL_GATEWAYS],
  );
  return rows[0];
}

let sock = null;
let connected = false;
const lastNotice = new Map(); // "{chat}|{order}[|bukti]" -> waktu notifikasi terakhir, supaya pesan beruntun tidak dikabarkan berulang
const recent = (key) => {
  if (Date.now() - (lastNotice.get(key) || 0) < 10 * 60_000) return true;
  lastNotice.set(key, Date.now());
  return false;
};

async function reply(jid, content, quoted) {
  await sock.presenceSubscribe(jid).catch(() => {});
  await sock.sendPresenceUpdate('composing', jid).catch(() => {});
  await sleep(between(1500, 4000));
  await sock.sendPresenceUpdate('paused', jid).catch(() => {});
  return sock.sendMessage(jid, content, quoted ? { quoted } : undefined);
}

function textOf(msg) {
  const m = msg.message || {};
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.documentMessage?.caption || '';
}

const jamWib = () => Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hourCycle: 'h23' }));
const jamTutup = () => { const h = jamWib(); return h >= JAM_TUTUP && h < JAM_BUKA; };
const tanggalWib = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
const jam = (h) => `${String(h).padStart(2, '0')}.00`;
const sudahDikabari = new Set(); // "{tanggal}|{chat}": satu kabar jam tutup per chat per malam

// Jam tutup: simpan pesan (dengan medianya) untuk diproses saat buka, dan kabari pengirim sekali per malam.
async function tundaPesan(msg) {
  const jid = msg.key.remoteJid;
  const media = await mediaOf(msg);
  fs.mkdirSync(TUNDA, { recursive: true });
  const berkas = `${TUNDA}/${Date.now()}-${String(msg.key.id).replace(/\W/g, '')}.json`;
  fs.writeFileSync(berkas, JSON.stringify({ msg: { key: msg.key, message: msg.message, messageTimestamp: msg.messageTimestamp, pushName: msg.pushName }, media }, BufferJSON.replacer));
  logger.info({ jid }, 'jam tutup: pesan ditunda sampai jam buka');
  const kunci = `${tanggalWib()}|${jid}`;
  if (sudahDikabari.has(kunci)) return;
  sudahDikabari.add(kunci);
  await reply(jid, { text: `Terima kasih sudah menghubungi kami 🙏 Saat ini di luar jam operasional (${jam(JAM_TUTUP)} sampai ${jam(JAM_BUKA)} WIB). Pesan kakak sudah kami terima dan akan kami balas mulai pukul ${jam(JAM_BUKA)} WIB ya.` }, msg);
}

// Jam buka: proses pesan yang ditunda, urut sesuai waktu masuk.
async function prosesTunda() {
  if (!connected || jamTutup() || !fs.existsSync(TUNDA)) return;
  for (const f of fs.readdirSync(TUNDA).filter((x) => x.endsWith('.json')).sort()) {
    const file = `${TUNDA}/${f}`;
    let item;
    try { item = JSON.parse(fs.readFileSync(file, 'utf8'), BufferJSON.reviver); } catch (e) { logger.error({ f, err: e.message }, 'pesan tunda rusak'); fs.unlinkSync(file); continue; }
    fs.unlinkSync(file);
    const msg = item.msg;
    msg._media = item.media ?? null;
    try { await handleIncoming(msg); } catch (e) { logger.error({ err: e.message }, 'gagal memproses pesan tunda'); }
    await sleep(between(2000, 5000));
  }
}

// Jam tutup: order yang tenggatnya jatuh di jam tutup (atau sebelum JAM_BUKA + PERPANJANG_MENIT) diperpanjang.
async function perpanjangOrderMalam() {
  if (!jamTutup()) return;
  const tgl = tanggalWib();
  const mulai = new Date(`${tgl}T${String(JAM_TUTUP).padStart(2, '0')}:00:00+07:00`);
  const sampai = new Date(new Date(`${tgl}T${String(JAM_BUKA).padStart(2, '0')}:00:00+07:00`).getTime() + PERPANJANG_MENIT * 60_000);
  const { rowCount } = await pool.query(
    `UPDATE "Order" SET "expiresAt" = $2, "updatedAt" = timezone('UTC', now())
      WHERE status = 'PENDING' AND "expiresAt" >= $1 AND "expiresAt" < $2`,
    // Kolom timestamp tanpa zona berisi waktu UTC, jadi dikirim sebagai teks UTC tanpa offset.
    [mulai.toISOString().slice(0, 23), sampai.toISOString().slice(0, 23)],
  );
  if (rowCount) logger.info({ jumlah: rowCount, sampai }, 'jam tutup: tenggat order diperpanjang');
}

// Blast info event dari dashboard dprochatbot: balasan STOP mencatat nomor di /data/blast-stop/berhenti.jsonl supaya tidak
// dikirimi blast lagi, MULAI membatalkannya. MULAI hanya ditangani untuk nomor yang pernah STOP.
const BERHENTI = '/data/blast-stop/berhenti.jsonl';
function sudahBerhenti(phone) {
  let last = null;
  try { for (const l of fs.readFileSync(BERHENTI, 'utf8').split('\n')) { if (!l) continue; const r = JSON.parse(l); if (r.phone === phone) last = r.aksi; } } catch { /* belum ada */ }
  return last === 'stop';
}
async function berhentiBlast(msg, jid) {
  const teks = textOf(msg).trim();
  const stop = /^(stop|berhenti|unsubscribe)[.!\s]*$/i.test(teks);
  if (!stop && !/^(mulai|start)[.!\s]*$/i.test(teks)) return false;
  const phone = digits(msg.key.senderPn || msg.key.remoteJidAlt || jid);
  if (!stop && !sudahBerhenti(phone)) return false;
  fs.mkdirSync('/data/blast-stop', { recursive: true });
  fs.appendFileSync(BERHENTI, JSON.stringify({ phone, jid, aksi: stop ? 'stop' : 'mulai', waktu: new Date().toISOString() }) + '\n');
  await reply(jid, { text: stop
    ? 'Baik Kak, kami tidak akan mengirim info event lagi ke nomor ini 🙏 Kalau suatu saat ingin menerimanya lagi, cukup balas MULAI ya.'
    : 'Siap Kak, info event dari kami akan kami kirimkan lagi ke nomor ini 😊' }, msg);
  logger.info({ phone, aksi: stop ? 'stop' : 'mulai' }, 'preferensi blast diperbarui');
  return true;
}

async function handleIncoming(msg) {
  const jid = msg.key.remoteJid || '';
  if (msg.key.fromMe || !jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
  if (PRIBADI && !(await pelangganPribadi(msg))) return; // chat pribadi pemilik nomor, bukan urusan bot
  if (jamTutup()) return tundaPesan(msg);
  // Kode booking DriveTech (BK-...) atau bukti bayarnya. Kalau API DriveTech gagal, pesan tetap masuk alur biasa (CS).
  if (await drivetech.handle(msg).catch((e) => { logger.error({ err: e.message }, 'DriveTech: pesan gagal diproses'); return false; })) return;
  if (await berhentiBlast(msg, jid)) return;
  const hasProof = !!(msg.message && (msg.message.imageMessage || msg.message.documentMessage));
  const match = textOf(msg).match(ORDER_RE);
  // Bukti bayar tanpa nomor order dari chat yang belum tercatat (misalnya QRIS dikirim admin lebih dulu): dicocokkan
  // ke order yang masih menunggu bayar lewat nomor HP pengirim, supaya tidak jatuh ke chatbot CS.
  if (hasProof && !match && !Object.values(confirmChats).includes(jid)) {
    const phone = digits(msg.key.senderPn || msg.key.remoteJidAlt || jid);
    const { rows } = phone.length < 10 ? { rows: [] } : await pool.query(
      `SELECT o.id FROM "Order" o
        WHERE o.status = 'PENDING' AND NOT o."isTest" AND right(regexp_replace(o."buyerPhone", '\\D', '', 'g'), 10) = right($1, 10)
        ORDER BY o."createdAt" DESC LIMIT 1`,
      [phone],
    );
    if (rows[0]) { confirmChats[rows[0].id] = jid; saveConfirmChats(); }
  }
  // Semua file dari pemesan yang terkait order diarsipkan, termasuk kiriman ulang yang tidak dikabarkan lagi.
  const archiveId = match ? match[0].toUpperCase() : hasProof && Object.keys(confirmChats).find((id) => confirmChats[id] === jid);
  if (hasProof && archiveId) {
    const media = await mediaOf(msg);
    await archive(archiveId, 'bukti bayar dari pemesan', media, jid);
    if (media) await saveProof(archiveId, media);
  }
  else if (match && !hasProof) await archive(archiveId, 'pesan pesanan masuk (minta QRIS)', null, jid);
  if (!match) {
    // Website error atau tidak bisa dibuka: kirim formulir pendaftaran lewat WhatsApp; formulir yang sudah diisi
    // didaftarkan lewat website (/api/bot/daftar) lalu dibalas QRIS seperti pendaftaran biasa.
    // Seperti admin: keluhan pertama dijawab chatbot CS dulu (minta screenshot, coba refresh, ganti browser Chrome).
    // Formulir baru dikirim kalau pelanggan bilang masih tidak bisa dalam 3 jam, atau memintanya sendiri.
    if (!hasProof && BOT_KEY) {
      const teks = textOf(msg);
      if (teks.toUpperCase().includes(FORM_HEADER)) return prosesFormulir(jid, msg, teks);
      const lanjutan = webKendala[jid] && Date.now() - webKendala[jid] < 3 * 3600_000 && (WEB_ERROR.test(teks) || MASIH.test(teks));
      if (MINTA_FORMULIR.test(teks) || lanjutan) {
        delete webKendala[jid];
        if (!recent(`${jid}|formulir`)) await kirimFormulir(jid, msg, lanjutan);
        return;
      }
      if (WEB_ERROR.test(teks)) webKendala[jid] = Date.now(); // diteruskan ke chatbot CS di bawah
    }
    // Screenshot bukti bayar yang dikirim menyusul (tanpa nomor order) di chat yang sudah konfirmasi.
    const pending = hasProof && Object.keys(confirmChats).find((id) => confirmChats[id] === jid);
    if (pending && !recent(`${jid}|${pending}|bukti`)) {
      const o = await loadOrder(pending);
      if (o && o.status !== 'PAID') await notifyProof(o, o.status !== 'PENDING' || (o.expiresAt && new Date(o.expiresAt) <= new Date()), msg);
    }
    if (!pending && !hasProof && (await remindProof(msg))) return;
    if (!pending) await csInbox(msg);
    return; // chat biasa: worker CS yang memutuskan dibalas atau diserahkan ke admin
  }
  const orderId = match[0].toUpperCase();
  if (recent(`${jid}|${orderId}${hasProof ? '|bukti' : ''}`)) return;

  const order = await loadOrder(orderId);
  if (!order) return logger.warn({ orderId }, 'nomor order di chat tidak ditemukan');
  if (order.status === 'PAID') {
    await reply(jid, { text: `Pembayaran order ${order.id} sudah terkonfirmasi. E-ticket kamu: ${SITE_URL}/tiket/${order.id}` }, msg);
    return;
  }

  confirmChats[order.id] = jid;
  saveConfirmChats();
  const expired = order.status !== 'PENDING' || (order.expiresAt && new Date(order.expiresAt) <= new Date());
  if (!hasProof) {
    if (!expired && PAID_CLAIM.test(textOf(msg)) && (await remindProof(msg, order))) return;
    if (expired) {
      await reply(jid, { text: `Mohon maaf kak, waktu bayar pesanan ${order.id} sudah habis, jadi pesanannya kedaluwarsa dan QRIS lamanya tidak bisa dipakai lagi.\n\n${await promoKalimat()}` }, msg);
    } else {
      await sendQris(jid, order, msg);
    }
    return;
  }
  if (expired) {
    // Bukti bayar untuk pesanan yang sudah kedaluwarsa: pembeli diminta daftar ulang; admin tetap dikabari supaya
    // uang yang terlanjur masuk bisa dicek dan ditindaklanjuti.
    await reply(jid, { text: `Terima kasih kak, bukti bayarnya sudah kami terima. Mohon maaf, pesanan ${order.id} sudah lewat batas waktu bayar sehingga tidak bisa kami proses lagi.\n\n${await promoKalimat()}\n\nKalau kakak sudah terlanjur membayar pesanan ini, tenang saja, admin kami akan menghubungi kakak untuk penyelesaiannya 🙏` }, msg);
  }
  await notifyProof(order, expired, msg);
}

// Mode pribadi: chat dianggap urusan KUWERA kalau sudah pernah tercatat, menyebut nomor order, kode booking DriveTech,
// atau "KUWERA 5K" (semua template tombol WhatsApp website memuatnya), atau nomornya milik pembeli/peserta KUWERA.
// Nomor di PRIBADI_IZIN (owner, staf) tidak pernah dianggap pelanggan.
// Chat yang pertama kali lolos mendapat kabar sekali bahwa layanan sementara lewat nomor ini.
async function pelangganPribadi(msg) {
  const jid = msg.key.remoteJid;
  if (pribadiChat[jid]) return true;
  const teks = textOf(msg);
  const phone = digits(msg.key.senderPn || msg.key.remoteJidAlt || jid);
  if (PRIBADI_IZIN.some((n) => phone.endsWith(n.slice(-10)))) return false; // owner/staf chat pribadi, bukan pelanggan
  let kenal = ORDER_RE.test(teks) || /\bBK-|kuwera (fun run )?5k/i.test(teks);
  if (!kenal) {
    if (phone.length >= 10) {
      const { rows } = await pool.query(
        `SELECT 1 FROM "Order" o WHERE NOT o."isTest" AND right(regexp_replace(o."buyerPhone", '\\D', '', 'g'), 10) = right($1, 10)
          UNION ALL SELECT 1 FROM "Participant" p JOIN "Order" o ON o.id = p."orderId"
           WHERE NOT o."isTest" AND right(regexp_replace(p.phone, '\\D', '', 'g'), 10) = right($1, 10) LIMIT 1`,
        [phone],
      );
      kenal = rows.length > 0;
    }
  }
  if (!kenal) return false;
  pribadiChat[jid] = Date.now();
  fs.writeFileSync(PRIBADI_FILE, JSON.stringify(pribadiChat));
  logger.info({ jid }, 'mode pribadi: chat pelanggan KUWERA baru');
  await reply(jid, { text: PRIBADI_INFO }).catch((e) => logger.error({ jid, err: e.message }, 'gagal kirim kabar nomor sementara'));
  return true;
}

// Mode pribadi: kiriman outbox hanya ke chat pelanggan yang sudah menghubungi nomor ini atau nomor PRIBADI_IZIN.
// Blast, urusan grup, dan tujuan lain dipindah ke OUTBOX_TAHAN (tidak dihapus) untuk dikirim lagi saat nomor kantor aktif.
function bolehPribadi(item, f) {
  if (f.includes('-blast-')) return false;
  if (item.tipe) return ['panduan-grup', 'ubah-deskripsi'].includes(item.tipe) && PRIBADI_GRUP.includes(item.jid);
  if (item.jid) return item.jid.endsWith('@g.us') ? PRIBADI_GRUP.includes(item.jid)
    : (!!pribadiChat[item.jid] || PRIBADI_IZIN.includes(digits(item.jid)));
  return !!buyerChat(item.orderId, item.phone);
}

// Pembeli bilang sudah bayar tapi tanpa gambar bukti: minta screenshot bukti bayarnya (atau kabari kalau buktinya
// sudah kami terima). Hanya untuk order yang masih menunggu bayar dari chat atau nomor HP yang sama.
const PAID_CLAIM = /\b(sudah|udah|udh|sdh|dah|telah|barusan|baru)\s*(saya\s*|aku\s*|sy\s*)?(bayar|dibayar|transfer|ditransfer|tf|trf|lunas|scan|payment)|\b(bukti|sudah)\s*(tf|transfer)|\bdone\s*(bayar|tf|transfer)/i;
async function remindProof(msg, known) {
  if (!known && !PAID_CLAIM.test(textOf(msg))) return false;
  const jid = msg.key.remoteJid;
  let order = known;
  if (!order) {
    const phone = digits(msg.key.senderPn || msg.key.remoteJidAlt || jid);
    const ids = Object.keys(confirmChats).filter((id) => confirmChats[id] === jid);
    const { rows } = await pool.query(
      `SELECT o.id FROM "Order" o
        WHERE o.status = 'PENDING' AND (o.id = ANY($2) OR (length($1) >= 10 AND right(regexp_replace(o."buyerPhone", '\\D', '', 'g'), 10) = right($1, 10)))
        ORDER BY o."createdAt" DESC LIMIT 1`,
      [phone, ids],
    );
    if (!rows.length) return false;
    order = await loadOrder(rows[0].id);
  }
  if (!order || order.status !== 'PENDING' || recent(`${jid}|${order.id}|klaim`)) return !!order && order.status === 'PENDING';
  const { rows: proofs } = await pool.query(`SELECT 1 FROM "PaymentProof" WHERE "orderId" = $1 LIMIT 1`, [order.id]);
  const name = order.buyer ? order.buyer.split(' ')[0] : 'kak';
  const text = proofs.length
    ? `Terima kasih Kak ${name}! Bukti bayar pesanan ${order.id} sudah kami terima dan sedang dicek admin. E-ticket dan QR registrasi ulang akan kami kirim ke chat ini setelah pembayaran dikonfirmasi ya 😊`
    : `Terima kasih Kak ${name}! Supaya pembayaran pesanan ${order.id} (${rupiah(order.total)}) bisa langsung kami cek, boleh kirimkan screenshot bukti bayarnya di chat ini ya 🙏`;
  confirmChats[order.id] = jid;
  saveConfirmChats();
  await reply(jid, { text }, msg);
  await archive(order.id, proofs.length ? 'pembeli bilang sudah bayar, bukti sudah ada' : 'pembeli bilang sudah bayar, diminta kirim bukti', null, jid);
  return true;
}

// Chat biasa dari nomor yang pernah memesan KUWERA diteruskan ke worker CS, kecuali admin baru membalas.
async function csInbox(msg) {
  const jid = msg.key.remoteJid;
  const m = msg.message || {};
  const media = m.imageMessage ? '[gambar]' : m.documentMessage ? '[dokumen]' : m.audioMessage ? '[pesan suara]'
    : m.videoMessage ? '[video]' : m.stickerMessage ? '[stiker]' : m.contactMessage ? '[kontak]' : m.locationMessage ? '[lokasi]' : '';
  const text = [media, textOf(msg).trim()].filter(Boolean).join(' ');
  if (!text || m.protocolMessage || m.reactionMessage) return;
  const phone = digits(msg.key.senderPn || msg.key.remoteJidAlt || jid);
  const known = Object.keys(confirmChats).filter((id) => confirmChats[id] === jid);
  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.total, o.quantity FROM "Order" o
      WHERE o.id = ANY($2)
         OR (length($1) >= 10 AND (right(regexp_replace(o."buyerPhone", '\\D', '', 'g'), 10) = right($1, 10)
         OR EXISTS (SELECT 1 FROM "Participant" p WHERE p."orderId" = o.id AND right(regexp_replace(p.phone, '\\D', '', 'g'), 10) = right($1, 10))))
      ORDER BY o."createdAt" DESC LIMIT 3`,
    [phone, known],
  );
  fs.mkdirSync(INBOX, { recursive: true });
  const item = { id: msg.key.id, bot: 'kuwera', jid, phone, nama: msg.pushName || '', text: text.slice(0, 1000), waktu: Date.now(),
    kontak: contacts[phone] || contacts[digits(jid)] || null,
    file: await saveCsMedia(msg),
    order: rows.map((o) => ({ id: o.id, status: o.status, total: rupiah(o.total), tiket: o.quantity })) };
  fs.writeFileSync(`${INBOX}/${msg.key.id}.json`, JSON.stringify(item));
}

// Screenshot atau dokumen dari pelanggan disimpan di INBOX supaya worker CS bisa meneruskannya ke Discord.
async function saveCsMedia(msg) {
  const media = (msg.message?.imageMessage || msg.message?.documentMessage) ? await mediaOf(msg) : null;
  if (!media) return null;
  fs.mkdirSync(INBOX, { recursive: true });
  const name = `${msg.key.id}-${media.name}`;
  fs.writeFileSync(`${INBOX}/${name}`, media.buffer);
  return name;
}

// Relay grup WA internal ke Hermes di Discord (bot D'Pro Ops). Konfigurasi /data/relay.json:
// { "parent": "<jid komunitas>", "groups": { "<jid grup>": "<nama>" }, "allowed": ["<nomor>"] }
// Semua pesan dari nomor di "allowed" (owner/superadmin) diteruskan langsung (tanpa kata panggil). Di grup staf ("openGroups")
// anggota lain juga boleh memakai bot tanpa login, tapi pesannya harus diawali "hermes" atau me-reply pesan bot; batas
// jumlah permintaan staf diatur bot D'Pro Ops. Awalan "hermes" dan tag nomor bot dibuang.
const RELAY_FILE = '/data/relay.json';
const RELAY_IN = '/data/relay-in';
const relayConfig = () => { try { return JSON.parse(fs.readFileSync(RELAY_FILE, 'utf8')); } catch { return { groups: {}, allowed: [] }; } };
function relayIncoming(msg) {
  const cfg = relayConfig();
  const group = msg.key.remoteJid;
  if (!cfg.groups?.[group] || msg.key.fromMe) return;
  const sender = digits(msg.key.participantAlt || msg.key.participant);
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const text = textOf(msg).trim();
  let sentIds = '';
  try { sentIds = fs.readFileSync(SENT_IDS, 'utf8'); } catch { sentIds = ''; }
  const replyToBot = !!ctx?.stanzaId && sentIds.includes(ctx.stanzaId);
  const isAdmin = (cfg.allowed || []).some((a) => sender.endsWith(String(a).slice(-10)));
  // #BUAT dan #DAFTAR (pembuat dokumen) boleh dipakai staf tanpa kata panggil "hermes"
  const staffCall = (cfg.openGroups || []).includes(group) && (/^(@\d+[\s,:]*)*hermes\b/i.test(text) || replyToBot || /^#(buat|daftar)\b/im.test(text));
  if (!(isAdmin || staffCall) || !text) {
    logger.info({ grup: cfg.groups[group], sender, allowed, replyToBot, awal: text.slice(0, 30) }, 'pesan grup tidak diteruskan');
    return;
  }
  fs.mkdirSync(RELAY_IN, { recursive: true });
  fs.writeFileSync(`${RELAY_IN}/${msg.key.id}.json`, JSON.stringify({
    id: msg.key.id, group, grup: cfg.groups[group], sender, nama: msg.pushName || '', waktu: Date.now(), reply: replyToBot, admin: isAdmin,
    text: text.replace(/^(@\d+[\s,:]*)+/, '').replace(/^hermes[\s,:]*/i, ''), quoted: ctx?.quotedMessage ? textOf({ message: ctx.quotedMessage }).slice(0, 500) : '',
  }));
}

// Kartu bayar dibuat website (QRIS dinamis bernominal total order), bot tinggal meneruskannya sebagai gambar.
async function qrisCard(orderId) {
  const res = await fetch(`${SITE_URL}/api/orders/${orderId}/qris`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    logger.error({ orderId, status: res.status }, 'gagal mengambil kartu QRIS');
    return null;
  }
  return Buffer.from(await res.arrayBuffer());
}

// --- Formulir pendaftaran lewat WhatsApp (cadangan kalau website tidak bisa dibuka) ---
const BOT_KEY = process.env.KUWERA_BOT_KEY || '';
const FORM_HEADER = 'FORMULIR PENDAFTARAN KUWERA 5K';
const WEB_ERROR = /(web|website|situs|link|halaman|laman|form|daftar|pendaftaran|kuwera5k).{0,40}(error|eror|gagal|tidak bisa|tdk bisa|gak bisa|ga bisa|gabisa|g bisa|nggak bisa|ngga bisa|blank|loading terus|lemot|macet|stuck|down|not found|404)|(tidak bisa|tdk bisa|gak bisa|ga bisa|gabisa|g bisa|nggak bisa|ngga bisa)\s*(di)?(buka|akses|masuk|daftar|lanjut)/i;
const MINTA_FORMULIR = /form(ulir)? manual|daftar (lewat|via|di) (wa|whatsapp|chat)|^\s*formulir\s*$/i;
const MASIH = /(masih|tetap|tetep)\s*(tidak|tdk|gak|ga|g|nggak|ngga|belum)?\s*(bisa|error|eror|gagal|blank|loading)|sama (aja|saja)|(sudah|udah|udh|sdh)\s*(coba|dicoba|refresh|pakai chrome|pake chrome|ganti browser)/i;
const webKendala = {}; // jid -> waktu keluhan website pertama (tahap 1 dijawab chatbot CS seperti admin)

async function botApi(path, body) {
  const res = await fetch(`${SITE_URL}/api/bot/${path}`, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(30000),
    headers: { 'x-bot-key': BOT_KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function kirimFormulir(jid, msg, masihKendala = false) {
  const { status, data } = await botApi('formulir');
  if (status !== 200 || !data.template) return logger.error({ status }, 'gagal mengambil template formulir');
  const pembuka = masihKendala
    ? 'Mohon maaf websitenya masih belum bisa dipakai ya Kak 🙏 Supaya Kakak tidak ketinggalan, pendaftarannya bisa lewat chat ini saja.'
    : 'Siap Kak, pendaftarannya bisa lewat chat ini 😊';
  await reply(jid, { text: `${pembuka} Silakan salin formulir di bawah, isi setelah tanda titik dua, lalu kirim balik ke sini. Satu formulir untuk satu peserta ya Kak. Setelah itu kami kirimkan QRIS pembayarannya.` }, msg);
  await reply(jid, { text: data.template });
}

async function prosesFormulir(jid, msg, teks) {
  if (recent(`${jid}|formulir-isi|${teks.length}`)) return; // pesan yang sama terkirim dua kali
  const terisi = teks.split('\n').filter((l) => /:\s*\S/.test(l) && !/^dengan mengirim/i.test(l.trim())).length;
  if (terisi < 5) {
    await reply(jid, { text: 'Formulirnya sepertinya belum diisi ya Kak 😊 Silakan isi setelah setiap tanda titik dua, lalu kirim lagi ke sini.' }, msg);
    return;
  }
  const { status, data } = await botApi('daftar', { text: teks });
  if (status !== 200 || !data.orderId) {
    const masalah = Array.isArray(data.masalah) && data.masalah.length ? data.masalah : ['Pendaftaran belum bisa diproses, coba kirim ulang sebentar lagi ya'];
    await reply(jid, { text: ['Terima kasih Kak, formulirnya sudah kami baca 🙏 Ada yang perlu dilengkapi dulu ya:', '', ...masalah.map((m) => `• ${m}`), '', 'Silakan perbaiki bagian itu lalu kirim ulang formulir lengkapnya ke sini.'].join('\n') }, msg);
    return;
  }
  const order = await loadOrder(data.orderId);
  if (!order) return logger.error({ orderId: data.orderId }, 'order dari formulir tidak ditemukan');
  confirmChats[order.id] = jid;
  saveConfirmChats();
  await archive(order.id, 'pendaftaran lewat formulir WhatsApp', null, jid);
  const nama = order.buyer ? order.buyer.split(' ')[0] : '';
  await reply(jid, { text: `Terima kasih Kak ${nama}! Pendaftarannya sudah kami terima dengan nomor pesanan ${order.id} 🙌 Berikut QRIS untuk pembayarannya ya.` }, msg);
  await sendQris(jid, order, msg);
}

async function sendQris(jid, order, quoted) {
  const image = await qrisCard(order.id);
  if (!image) {
    await notify(`KUWERA 5K: kartu QRIS order ${order.id} gagal dibuat. Balas pemesan manual di WA kantor.`);
    return;
  }
  const deadline = order.expiresAt
    ? new Date(order.expiresAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null;
  const caption = [
    `QRIS pembayaran order ${order.id}`,
    `Nominal: ${rupiah(order.total)} (${order.quantity} tiket)`,
    '',
    'Silakan scan dari aplikasi bank atau e-wallet apa pun. Nominalnya sudah terisi otomatis, mohon dibayar sesuai angka itu ya.',
    `Setelah membayar, screenshot bukti bayarnya bisa dikirim di chat ini.${deadline ? ` Kami tunggu pembayarannya sebelum ${deadline} WIB.` : ''}`,
    'Pembayaran QRIS ini kami verifikasi manual, paling lama 1x24 jam. E-ticket dikirim otomatis begitu terverifikasi ya.',
  ].join('\n');
  await reply(jid, { image, caption }, quoted);
  await archive(order.id, 'QRIS/invoice dikirim ke pemesan', { buffer: image, name: 'invoice-qris.png' }, jid);
}

// Ke superadmin: kartu invoice yang sama dengan milik pemesan plus bukti bayarnya, dalam satu pesan Discord
// dengan tombol Setujui/Tolak. Kalau Discord gagal, pakai jalur Telegram lama (reply foto bukti dengan "ok").
async function notifyProof(order, expired, msg) {
  const card = order.status === 'PENDING' ? await qrisCard(order.id) : null;
  const media = await mediaOf(msg);
  const head = [
    `KUWERA 5K: bukti bayar order ${order.id}${expired ? ' (waktu bayar sudah habis)' : ''}`,
    `Pemesan: ${order.buyer || '-'}, ${order.quantity} tiket`,
    `Nominal yang harus masuk: ${rupiah(order.total)}`,
    '',
  ];
  try {
    const files = [card && { buffer: card, name: `invoice-${order.id}.png` }, media && { buffer: media.buffer, name: `${order.id}-${media.name}` }].filter(Boolean);
    proofMessages[order.id] = await discord([
      ...head,
      'Cek riwayat GoPay Merchant. Kalau nominalnya persis masuk, klik Setujui. Kalau belum ada, klik Tolak lalu isi alasannya.',
      media ? '' : '(Gambar bukti gagal diteruskan, lihat di chat WA kantor.)',
      `Bisa juga lewat ${SITE_URL}/kuweraadmin/peserta/${order.id}`,
    ].join('\n'), { files, approve: order.id });
    saveProofMessages();
    return;
  } catch (e) {
    logger.warn({ err: e.message, orderId: order.id }, 'Discord gagal, bukti bayar dikirim ke Telegram');
  }
  if (card) await telegramFile('photo', card, `invoice-${order.id}.png`, `Invoice yang dikirim ke pemesan ${order.buyer || '-'}, order ${order.id}`);
  const caption = [
    ...head,
    'Cek riwayat GoPay Merchant. Kalau nominalnya persis masuk, reply foto ini dengan: ok',
    'Kalau belum ada, reply dengan: tolak <alasan>',
    `Bisa juga lewat ${SITE_URL}/kuweraadmin/peserta/${order.id}`,
  ].join('\n');
  const messageId = media
    ? await telegramFile(media.kind, media.buffer, `${order.id}-${media.name}`, caption)
    : await telegram(`${caption}\n\n(Gambar bukti gagal diteruskan, lihat di chat WA kantor.)`).then(() => null);
  if (messageId) {
    proofMessages[order.id] = messageId;
    saveProofMessages();
  }
}

// Satu tujuan per pemesan: chat tempat dia menghubungi bot. Chat itu sering tercatat sebagai ...@lid, sedangkan
// nomor HP di form menjadi ...@s.whatsapp.net; keduanya orang yang sama, jadi kirim ke dua-duanya membuat pesan dobel.
// Nomor di form hanya dipakai kalau pemesan belum pernah chat.
// Mode pribadi: hanya chat yang sudah menghubungi nomor pribadi, supaya bot tidak memulai chat baru.
const buyerChat = (orderId, phone) => (PRIBADI
  ? (pribadiChat[confirmChats[orderId]] ? confirmChats[orderId] : null)
  : confirmChats[orderId] || phoneJid(phone));

// Pesan penolakan dari tool kuwera_tolak (cli.js) menunggu di /data/outbox sebagai file JSON.
async function processOutbox() {
  if (!connected) return;
  fs.mkdirSync(OUTBOX, { recursive: true });
  for (const f of fs.readdirSync(OUTBOX).filter((x) => x.endsWith('.json')).sort()) {
    const file = `${OUTBOX}/${f}`;
    const item = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (PRIBADI && !bolehPribadi(item, f)) {
      fs.mkdirSync(OUTBOX_TAHAN, { recursive: true });
      fs.renameSync(file, `${OUTBOX_TAHAN}/${f}`);
      logger.warn({ f, jid: item.jid, orderId: item.orderId }, 'mode pribadi: kiriman outbox ditahan');
      continue;
    }
    if (item.tipe === 'buat-grup') { // grup baru di komunitas internal, lalu deskripsi aturannya
      fs.unlinkSync(file);
      try {
        const cfg = relayConfig();
        const meta = await sock.communityCreateGroup(item.subject, item.participants || [], cfg.parent);
        if (item.description) await sock.groupUpdateDescription(meta.id, item.description);
        cfg.groups = { ...(cfg.groups || {}), [meta.id]: item.subject };
        fs.writeFileSync(RELAY_FILE, JSON.stringify(cfg, null, 1));
        logger.info({ id: meta.id, subject: item.subject }, 'grup internal dibuat');
      } catch (e) { logger.error({ subject: item.subject, err: e.message }, 'gagal membuat grup'); }
      await sleep(between(3000, 6000));
      continue;
    }
    if (item.tipe === 'kontak') { // simpan kontak pelanggan (antrean dari dprochatbot), ikut tersimpan di buku kontak HP kantor
      fs.unlinkSync(file);
      try {
        await sock.addOrEditContact(item.jid, { fullName: item.nama, firstName: item.nama, saveOnPrimaryAddressbook: true });
        logger.info({ jid: item.jid, nama: item.nama }, 'kontak disimpan');
      } catch (e) { logger.error({ jid: item.jid, err: e.message }, 'gagal menyimpan kontak'); }
      await sleep(between(2000, 4000));
      continue;
    }
    if (item.tipe === 'ubah-deskripsi') { // hanya deskripsi grup, tanpa kirim pesan
      fs.unlinkSync(file);
      try { await sock.groupUpdateDescription(item.jid, item.description); logger.info({ jid: item.jid }, 'deskripsi grup diubah'); }
      catch (e) { logger.error({ jid: item.jid, err: e.message }, 'gagal mengubah deskripsi grup'); }
      await sleep(between(2000, 4000));
      continue;
    }
    if (item.tipe === 'panduan-grup') { // deskripsi grup diperbarui, lalu panduan dikirim dan disematkan 30 hari
      fs.unlinkSync(file);
      try {
        if (item.description) await sock.groupUpdateDescription(item.jid, item.description);
        for (const id of item.unpin || []) { // lepas sematan panduan lama
          await sock.sendMessage(item.jid, { pin: { remoteJid: item.jid, fromMe: true, id }, type: 2 }).catch(() => {});
        }
        const sent = await reply(item.jid, { text: item.text });
        await sock.sendMessage(item.jid, { pin: sent.key, type: 1, time: 2592000 });
        logger.info({ jid: item.jid }, 'panduan grup dikirim dan disematkan');
      } catch (e) { logger.error({ jid: item.jid, err: e.message }, 'gagal memasang panduan grup'); }
      await sleep(between(3000, 6000));
      continue;
    }
    if (item.jid) { // balasan worker CS
      // audio (voice note, ogg opus) atau gambar: file ada di /data/media, dibuat bot D'Pro Ops
      const media = item.audio ? { audio: fs.readFileSync(`/data/media/${item.audio}`), mimetype: 'audio/ogg; codecs=opus', ptt: true }
        : item.image ? { image: fs.readFileSync(`/data/media/${item.image}`), caption: item.text || undefined }
        : item.document ? { document: fs.readFileSync(`/data/media/${item.document}`), fileName: item.fileName || item.document,
            mimetype: item.mimetype || 'application/octet-stream', caption: item.text || undefined } : null;
      try {
        if (media) await reply(item.jid, media);
        if (item.text && !item.image && !item.document) await reply(item.jid, { text: item.text, ...(item.mentions ? { mentions: item.mentions } : {}) });
      } catch (e) { logger.error({ jid: item.jid, err: e.message }, 'gagal kirim balasan CS'); }
      fs.unlinkSync(file);
      logger.info({ jid: item.jid, topik: item.topik }, 'balasan CS terkirim');
      continue;
    }
    const targets = [buyerChat(item.orderId, item.phone)].filter(Boolean);
    for (const jid of targets) {
      try { await reply(jid, { text: item.text }); } catch (e) { logger.error({ jid, err: e.message }, 'gagal kirim pesan outbox'); }
    }
    fs.unlinkSync(file);
    await archive(item.orderId, `ditolak oleh ${item.oleh || 'superadmin'}, pesan dikirim ke pemesan`);
  }
}

// Order yang baru ditandai lunas: kirim tautan tiket ke pemesan, lalu kabari superadmin.
async function processPaid() {
  const { rows } = await pool.query(
    `SELECT o.id, o.total, o.quantity, o."paidAt", o."buyerPhone", o."waNotifiedAt", o."adminNotifiedAt",
            (SELECT p."fullName" FROM "Participant" p WHERE p."orderId" = o.id ORDER BY p.position LIMIT 1) AS buyer,
            (SELECT p."rawPayload"->>'verifiedBy' FROM "Payment" p WHERE p."orderId" = o.id ORDER BY p."receivedAt" DESC LIMIT 1) AS verified_by,
            (SELECT p."rawPayload"->>'via' FROM "Payment" p WHERE p."orderId" = o.id ORDER BY p."receivedAt" DESC LIMIT 1) AS verified_via,
            (SELECT p.gateway FROM "Payment" p WHERE p."orderId" = o.id ORDER BY p."receivedAt" DESC LIMIT 1) AS gateway
       FROM "Order" o
      WHERE o.status = 'PAID' AND (o."waNotifiedAt" IS NULL OR o."adminNotifiedAt" IS NULL)
        AND o."paidAt" > timezone('UTC', now()) - interval '3 days'
        AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."orderId" = o.id AND p.gateway = ANY($1))
      ORDER BY o."paidAt" LIMIT 10`,
    [REAL_GATEWAYS],
  );
  for (const o of rows) {
    // Mode pribadi: tiket menunggu sampai pembeli menghubungi nomor ini (atau nomor kantor aktif lagi).
    if (!o.waNotifiedAt && connected && buyerChat(o.id, o.buyerPhone)) {
      const { rows: tickets } = await pool.query(
        `SELECT t.code, p."fullName" FROM "Ticket" t JOIN "Participant" p ON p.id = t."participantId"
          WHERE t."orderId" = $1 ORDER BY p.position`,
        [o.id],
      );
      const text = [
        `Pembayaran order ${o.id} sebesar ${rupiah(o.total)} sudah kami terima. Terima kasih, ${o.buyer || 'kak'}!`,
        '',
        'Nomor QR registrasi ulang (ditunjukkan saat mengambil race pack):',
        ...tickets.map((t, i) => `${i + 1}. ${t.fullName}: ${t.code}`),
        '',
        `E-ticket lengkap: ${SITE_URL}/tiket/${o.id}`,
        '',
        `Race pack bisa diambil pada ${RACE_PACK}. Kamis pukul 08.00 sampai 20.00 WIB, Jumat pukul 08.00 sampai 19.00 WIB. Di hari lomba tidak ada pengambilan. Jangan lupa bawa KTP atau KIA asli setiap peserta, ya.`,
        `Hari lomba: ${RACE_DAY}.`,
        '',
        'QR setiap peserta kami kirim di bawah ini. Disimpan baik-baik ya, sampai jumpa di garis start!',
      ].join('\n');
      const targets = [buyerChat(o.id, o.buyerPhone)].filter(Boolean);
      for (const jid of targets) {
        try {
          await reply(jid, { text });
          for (const t of tickets) {
            const image = await QRCode.toBuffer(t.code, { width: 600, margin: 2, color: { dark: '#0B4A2C', light: '#FFFFFF' } });
            await reply(jid, { image, caption: `QR registrasi ulang KUWERA 5K\n${t.fullName}\n${t.code}` });
          }
        } catch (e) { logger.error({ id: o.id, jid, err: e.message }, 'gagal kirim tiket'); }
      }
      await pool.query(`UPDATE "Order" SET "waNotifiedAt" = timezone('UTC', now()) WHERE id = $1`, [o.id]);
      await archive(o.id, `lunas, e-ticket dan QR registrasi ulang dikirim (${tickets.map((t) => t.code).join(', ')})`);
      delete confirmChats[o.id];
      saveConfirmChats();
    }
    if (!o.adminNotifiedAt) {
      const sum = await incomeSummary();
      const lewat = { telegram: 'Telegram', discord: 'Discord' }[o.verified_via] || 'halaman admin';
      await notify([
        'KUWERA 5K: pembayaran terverifikasi',
        `Order ${o.id}, ${o.quantity} tiket, ${rupiah(o.total)}`,
        `Pemesan: ${o.buyer || '-'}`,
        `Disetujui: ${o.gateway === 'qris-manual' ? `${o.verified_by || 'admin'} lewat ${lewat}` : o.gateway}, ${wib(o.paidAt)}`,
        'Tautan e-ticket dikirim ke WhatsApp pemesan.',
        '',
        `Total pemasukan terverifikasi: ${rupiah(sum.total)}`,
        `${sum.tickets} tiket dari ${sum.orders} pembelian`,
      ].join('\n'), proofMessages[o.id]);
      await pool.query(`UPDATE "Order" SET "adminNotifiedAt" = timezone('UTC', now()) WHERE id = $1`, [o.id]);
      delete proofMessages[o.id];
      saveProofMessages();
    }
  }
}

// Pengingat bayar: order yang batas bayarnya tinggal 60 menit dan belum ada bukti bayar dikirimi panduan sekali.
// Belum pernah chat bot = panduan minta QRIS lewat halaman bayar; sudah menerima QRIS = ajakan bayar dan kirim bukti.
async function processReminders() {
  if (!connected) return;
  const { rows } = await pool.query(
    `SELECT o.id, o.total, o."expiresAt", o."buyerPhone",
            (SELECT p."fullName" FROM "Participant" p WHERE p."orderId" = o.id ORDER BY p.position LIMIT 1) AS buyer
       FROM "Order" o
      WHERE o.status = 'PENDING' AND o."uniqueCode" > 0
        AND o."expiresAt" > timezone('UTC', now()) AND o."expiresAt" <= timezone('UTC', now()) + make_interval(mins => $1)
        AND NOT EXISTS (SELECT 1 FROM "PaymentProof" f WHERE f."orderId" = o.id)`,
    [REMIND_MINUTES],
  );
  for (const o of rows) {
    if (reminded[o.id] || proofMessages[o.id]) continue;
    const jid = buyerChat(o.id, o.buyerPhone);
    if (!jid) continue;
    const name = o.buyer ? o.buyer.split(' ')[0] : 'kak';
    const jam = new Date(o.expiresAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
    const text = confirmChats[o.id]
      ? [
          `Halo kak ${name}, QRIS pembayaran pesanan KUWERA 5K ${o.id} sebesar ${rupiah(o.total)} berlaku sampai pukul ${jam} WIB, sekitar ${REMIND_MINUTES} menit lagi.`,
          '',
          'Kalau sudah membayar, kirimkan screenshot bukti bayarnya di chat ini ya. Kalau belum, yuk selesaikan sekarang supaya slot kamu tetap aman 😊',
        ].join('\n')
      : [
          `Halo kak ${name}, pesanan KUWERA 5K kamu (${o.id}, ${rupiah(o.total)}) masih menunggu pembayaran dan berakhir pukul ${jam} WIB, sekitar ${REMIND_MINUTES} menit lagi.`,
          '',
          'Yuk lanjutkan sebentar:',
          `1. Buka ${SITE_URL}/bayar/${o.id}`,
          '2. Tekan "Minta QRIS via WhatsApp", lalu kirim pesannya.',
          '3. Bayar QRIS yang kami kirim, lalu kirim screenshot bukti bayarnya di chat ini.',
          '',
          'Kalau ada kendala, balas saja pesan ini ya, kami bantu 😊',
        ].join('\n');
    try {
      await reply(jid, { text });
      reminded[o.id] = Date.now();
      fs.writeFileSync(REMIND_FILE, JSON.stringify(reminded));
      await archive(o.id, `pengingat bayar ${REMIND_MINUTES} menit dikirim`, null, jid);
      logger.info({ orderId: o.id, jid }, 'pengingat bayar terkirim');
    } catch (e) {
      logger.error({ orderId: o.id, err: e.message }, 'gagal kirim pengingat bayar');
    }
  }
}

// Harga promo berlaku: dinyalakan, dalam jendela waktunya, dan kuota tiketnya (promo.quota) belum habis.
// Sama dengan promoActive() di src/lib/pricing.ts.
// Jam "HH:MM" WIB pada tanggal WIB yang sama dengan `day`.
function pukulWib(day, hhmm) {
  const d = new Date(day.getTime() + 7 * 3600_000);
  d.setUTCHours(Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)), 0, 0);
  return new Date(d.getTime() - 7 * 3600_000);
}

// Akhir harga promo yang sedang berlaku: jam selesai harian hari ini atau promo.end, mana yang lebih dulu.
function promoSampai(promo, now = new Date()) {
  const ends = [promo.end && new Date(promo.end), promo.daily && pukulWib(now, promo.daily.to)].filter(Boolean);
  if (!ends.length) return '';
  const t = new Date(Math.min(...ends));
  const hari = t.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }) === now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
  return ` sampai ${hari ? 'hari ini pukul ' : ''}${t.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', ...(hari ? {} : { day: 'numeric', month: 'long' }), hour: '2-digit', minute: '2-digit' })} WIB`;
}

async function promoBerlaku(promo, now = new Date()) {
  if (!promo?.enabled || (promo.start && now < new Date(promo.start)) || (promo.end && now >= new Date(promo.end))) return false;
  if (promo.daily && (now < pukulWib(now, promo.daily.from) || now >= pukulWib(now, promo.daily.to))) return false;
  if (!promo.quota) return true;
  const { rows: [r] } = await pool.query(
    `SELECT coalesce(sum(quantity), 0)::int AS n FROM "Order"
      WHERE NOT "isTest" AND source = 'web' AND subtotal = $1 * quantity
        AND (status = 'PAID' OR (status = 'PENDING' AND "expiresAt" > timezone('UTC', now())))`,
    [promo.price],
  );
  return r.n < promo.quota;
}

// Kalimat promo untuk pembeli yang pesanannya kedaluwarsa: harga promo kalau masih berlaku, kalau tidak harga reguler.
async function promoKalimat() {
  const { rows: [setting] } = await pool.query(`SELECT value FROM "Setting" WHERE key = 'pricing'`);
  const pricing = setting?.value || {};
  const promo = pricing.promo;
  const now = new Date();
  const on = await promoBerlaku(promo, now);
  if (on) {
    const sampai = promoSampai(promo, now);
    return `Harga ${promo.label || 'Early Bird'} ${rupiah(promo.price)} per tiket sedang berlaku${sampai}, jadi yuk daftar ulang di ${SITE_URL}/daftar dan selesaikan pembayaran dengan QRIS yang baru ya.`;
  }
  const reguler = pricing.regular?.price ? ` Harga yang berlaku sekarang ${pricing.regular.label || 'Reguler'} ${rupiah(pricing.regular.price)} per tiket.` : '';
  // Promo harian yang masih berlanjut di hari lain: kabari jamnya, bukan "sudah berakhir".
  if (promo?.enabled && promo.daily && (!promo.end || now < new Date(promo.end))) {
    const jam = (v) => v.replace(':', '.');
    const sampaiTgl = promo.end ? ` sampai ${new Date(promo.end).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long' })}` : '';
    return `Harga ${promo.label || 'Early Bird'} ${rupiah(promo.price)} hadir tiap hari pukul ${jam(promo.daily.from)} sampai ${jam(promo.daily.to)} WIB${sampaiTgl}, selama kuotanya masih ada.${reguler} Kalau masih mau lari bareng kami, silakan daftar ulang di ${SITE_URL}/daftar lalu bayar sesuai tagihan yang baru ya.`;
  }
  return `Harga promonya sudah berakhir.${reguler} Kalau masih mau lari bareng kami, silakan daftar ulang di ${SITE_URL}/daftar lalu bayar sesuai tagihan yang baru ya.`;
}

// Ajak daftar ulang: order yang lewat batas bayar tanpa bukti bayar dikirimi kabar sekali bahwa pesanannya kedaluwarsa
// dan cara mendaftar ulang (harga promo disebut kalau masih berlaku). Ordernya sekalian ditandai EXPIRED.
// Nomor yang sudah punya order lain setelahnya (lunas atau masih menunggu) dilewati.
const AJAK_FILE = '/data/ajak-ulang.json';
let diajak = {};
try { diajak = JSON.parse(fs.readFileSync(AJAK_FILE, 'utf8')); } catch { diajak = {}; }
async function processAjakUlang() {
  if (!connected) return;
  const { rows: [setting] } = await pool.query(`SELECT value FROM "Setting" WHERE key = 'pricing'`);
  const pricing = setting?.value || {};
  const promo = pricing.promo;
  const now = new Date();
  const promoOn = await promoBerlaku(promo, now);
  const { rows } = await pool.query(
    `SELECT o.id, o."buyerPhone",
            (SELECT p."fullName" FROM "Participant" p WHERE p."orderId" = o.id ORDER BY p.position LIMIT 1) AS buyer
       FROM "Order" o
      WHERE o.status IN ('PENDING', 'EXPIRED') AND NOT o."isTest"
        AND o."expiresAt" < timezone('UTC', now()) - interval '30 minutes'
        AND o."expiresAt" > timezone('UTC', now()) - interval '3 days'
        AND NOT EXISTS (SELECT 1 FROM "PaymentProof" f WHERE f."orderId" = o.id)
        AND NOT EXISTS (SELECT 1 FROM "Order" b WHERE b.id <> o.id AND b.status IN ('PAID', 'PENDING') AND NOT b."isTest"
                          AND right(regexp_replace(b."buyerPhone", '\\D', '', 'g'), 10) = right(regexp_replace(o."buyerPhone", '\\D', '', 'g'), 10)
                          AND b."createdAt" > o."createdAt")`,
  );
  for (const o of rows) {
    if (diajak[o.id]) continue;
    const jid = buyerChat(o.id, o.buyerPhone);
    if (!jid) continue;
    const name = o.buyer ? o.buyer.split(' ')[0] : 'kak';
    const sampai = promoOn ? promoSampai(promo, now) : '';
    const text = [
      `Halo kak ${name} 😊 Pesanan KUWERA 5K kamu (${o.id}) belum sempat dibayar sampai batas waktunya, jadi pesanannya sudah kedaluwarsa.`,
      '',
      promoOn
        ? `Kabar baiknya, harga ${promo.label || 'Early Bird'} ${rupiah(promo.price)} per tiket masih berlaku${sampai}. Kalau masih mau lari bareng kami, yuk daftar ulang di ${SITE_URL}/daftar dan selesaikan pembayarannya ya.`
        : await promoKalimat(),
      '',
      'Setelah bayar, kirim screenshot bukti bayarnya di chat ini supaya bisa langsung kami cek. Sampai jumpa di garis start! 🏃',
    ].join('\n');
    try {
      await reply(jid, { text });
      await pool.query(`UPDATE "Order" SET status = 'EXPIRED', "updatedAt" = timezone('UTC', now()) WHERE id = $1 AND status = 'PENDING'`, [o.id]);
      diajak[o.id] = Date.now();
      fs.writeFileSync(AJAK_FILE, JSON.stringify(diajak));
      await archive(o.id, 'ajakan daftar ulang (lewat batas bayar) dikirim', null, jid);
      logger.info({ orderId: o.id, jid }, 'ajakan daftar ulang terkirim');
    } catch (e) {
      logger.error({ orderId: o.id, err: e.message }, 'gagal kirim ajakan daftar ulang');
    }
    await sleep(between(20000, 40000));
  }
}

async function paidLoop() {
  for (;;) {
    try { await processPaid(); } catch (e) { logger.error({ err: e.message }, 'proses order lunas gagal'); }
    try { await processOutbox(); } catch (e) { logger.error({ err: e.message }, 'proses outbox gagal'); }
    // Pengingat dan kabar otomatis tidak dikirim di jam tutup; balasan admin (outbox, lunas) tetap jalan.
    if (!jamTutup() && !PRIBADI) {
      try { await processReminders(); } catch (e) { logger.error({ err: e.message }, 'proses pengingat bayar gagal'); }
      try { await processAjakUlang(); } catch (e) { logger.error({ err: e.message }, 'proses ajakan daftar ulang gagal'); }
      try { await drivetech.tick(); } catch (e) { logger.error({ err: e.message }, 'kabar DriveTech gagal'); }
    }
    try { await perpanjangOrderMalam(); } catch (e) { logger.error({ err: e.message }, 'perpanjang order malam gagal'); }
    try { await prosesTunda(); } catch (e) { logger.error({ err: e.message }, 'proses pesan tunda gagal'); }
    await sleep(20000);
  }
}

// Sesi WhatsApp (tautan QR, sambung ulang) dipegang WAHA; bot hanya memakai API dan webhook-nya (lihat waha-sock.js).
async function start() {
  const s = makeWahaSock({ logger });
  const send = s.sendMessage;
  s.sendMessage = async (...args) => {
    const sent = await send(...args);
    if (sent?.key?.id) fs.appendFileSync(SENT_IDS, sent.key.id + '\n');
    return sent;
  };
  sock = s;
  s.ev.on('connection.update', ({ connection, statusCode, status }) => {
    connected = connection === 'open';
    if (!connected) { logger.warn({ statusCode, status, reconnect: statusCode !== 401 }, 'koneksi WhatsApp terputus'); return; }
    logger.info({ pribadi: PRIBADI }, 'bot KUWERA terhubung ke WhatsApp');
    if (PRIBADI) return; // daftar grup di bawah milik nomor kantor
    // Daftar grup yang diikuti nomor kantor (id -> nama), dipakai worker CS untuk laporan ke grup tim.
    s.groupFetchAllParticipating()
      .then((g) => fs.writeFileSync('/data/groups.json', JSON.stringify(Object.fromEntries(Object.values(g).map((x) => [x.id, x.subject])))))
      .catch((e) => logger.warn({ err: e.message }, 'gagal mengambil daftar grup'));
  });
  s.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const m of messages) {
      // Nama pengirim di grup (misal Ce Nadia di grup Kuwera Run), supaya worker CS bisa men-tag orang yang tepat.
      if (!PRIBADI && !m.key.fromMe && m.key.remoteJid?.endsWith('@g.us') && m.key.participant && m.pushName) {
        let senders = {};
        try { senders = JSON.parse(fs.readFileSync('/data/group-senders.json', 'utf8')); } catch { senders = {}; }
        const who = m.key.participantAlt || m.key.participant;
        if (senders[who] !== m.pushName) {
          senders[who] = m.pushName;
          fs.writeFileSync('/data/group-senders.json', JSON.stringify(senders));
        }
      }
      if (!m.key.fromMe || !m.key.remoteJid || m.key.remoteJid.endsWith('@g.us') || m.key.remoteJid === 'status@broadcast') continue;
      if (PRIBADI && !pribadiChat[m.key.remoteJid]) continue; // chat pribadi pemilik nomor tidak dicatat
      // Semua pesan keluar diteruskan; worker CS mencocokkan ID-nya dengan sent-ids kedua bot untuk tahu mana balasan admin.
      fs.mkdirSync(INBOX, { recursive: true });
      fs.writeFileSync(`${INBOX}/admin-${m.key.id}.json`, JSON.stringify({ tipe: 'admin', id: m.key.id, bot: 'kuwera', jid: m.key.remoteJid,
        phone: digits(m.key.remoteJidAlt || m.key.remoteJid), text: textOf(m).slice(0, 300) || '[media]', waktu: Date.now() }));
    }
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.remoteJid?.endsWith('@g.us')) { if (PRIBADI && !PRIBADI_GRUP.includes(msg.key.remoteJid)) continue; try { relayIncoming(msg); } catch (e) { logger.error({ err: e.message }, 'relay grup gagal'); } continue; }
      try { await handleIncoming(msg); } catch (e) { logger.error({ err: e.message }, 'gagal memproses pesan masuk'); }
    }
  });
}

// Bayar manual DriveTech di nomor yang sama (lihat drivetech.js).
const drivetech = require('./drivetech')(() => ({
  reply, mediaOf, discord, notify, recent, textOf, PAID_CLAIM, logger, isConnected: () => connected,
}));

start().catch((e) => { logger.error({ err: e.message }, 'gagal start bot'); process.exit(1); });
paidLoop();
