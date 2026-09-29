// Bot WhatsApp KUWERA 5K untuk bayar manual QRIS.
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
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
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
const humanAt = new Map(); // jid -> waktu terakhir admin membalas dari HP
// ponytail: pesan kiriman Baileys ber-ID "3EB0...", dari HP tidak. Cukup untuk membedakan admin dari bot.
const byHuman = (msg) => msg.key.fromMe && !String(msg.key.id || '').startsWith('3EB0');
// Arsip per order (bukti bayar, invoice, info.json) plus riwayat.csv; disalin ke NAS oleh kuwera-arsip-nas di VPS.
const ARCHIVE = '/data/arsip';
// Sama dengan src/lib/event-data.ts (racePackDates, racePackPlace, racePackHours, jadwal acara).
const RACE_PACK = 'Kamis dan Jumat, 22 dan 23 Oktober 2026 di Kudam V/Brawijaya';
const RACE_DAY = 'Sabtu, 24 Oktober 2026, 06.00 WIB di Lapangan Rampal';

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

// Kirim ke Discord #chatbot lewat bot D'Pro Ops. files: [{ buffer, name }]. approve: nomor order untuk tombol
// Setujui/Tolak. Mengembalikan id pesan (teks) supaya kabar lunas bisa dibalas ke pesan yang sama.
async function discord(content, { replyTo, files = [], approve } = {}) {
  if (!DC_TOKEN || !DC_CHANNEL) throw new Error('Discord belum diatur');
  const payload = { content: content.slice(0, 1990), allowed_mentions: { parse: [] } };
  if (replyTo) payload.message_reference = { message_id: replyTo, fail_if_not_exists: false };
  if (approve) {
    payload.components = [{ type: 1, components: [
      { type: 2, style: 3, label: 'Setujui', emoji: { name: '✅' }, custom_id: `kuwera:setujui:${approve}` },
      { type: 2, style: 4, label: 'Tolak', emoji: { name: '❌' }, custom_id: `kuwera:tolak:${approve}` },
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
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
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
      WHERE o.status = 'PAID'
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
  await sock.sendMessage(jid, content, quoted ? { quoted } : undefined);
}

function textOf(msg) {
  const m = msg.message || {};
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.documentMessage?.caption || '';
}

async function handleIncoming(msg) {
  const jid = msg.key.remoteJid || '';
  if (msg.key.fromMe || !jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
  const hasProof = !!(msg.message && (msg.message.imageMessage || msg.message.documentMessage));
  const match = textOf(msg).match(ORDER_RE);
  // Semua file dari pemesan yang terkait order diarsipkan, termasuk kiriman ulang yang tidak dikabarkan lagi.
  const archiveId = match ? match[0].toUpperCase() : hasProof && Object.keys(confirmChats).find((id) => confirmChats[id] === jid);
  if (hasProof && archiveId) {
    const media = await mediaOf(msg);
    await archive(archiveId, 'bukti bayar dari pemesan', media, jid);
    if (media) await saveProof(archiveId, media);
  }
  else if (match && !hasProof) await archive(archiveId, 'pesan pesanan masuk (minta QRIS)', null, jid);
  if (!match) {
    // Screenshot bukti bayar yang dikirim menyusul (tanpa nomor order) di chat yang sudah konfirmasi.
    const pending = hasProof && Object.keys(confirmChats).find((id) => confirmChats[id] === jid);
    if (pending && !recent(`${jid}|${pending}|bukti`)) {
      const o = await loadOrder(pending);
      if (o && o.status !== 'PAID') await notifyProof(o, o.status !== 'PENDING' || (o.expiresAt && new Date(o.expiresAt) <= new Date()), msg);
    }
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
    if (expired) {
      await reply(jid, { text: `Mohon maaf kak, waktu bayar order ${order.id} sudah habis. Kamu masih bisa mendaftar lagi di ${SITE_URL}/daftar, kami tunggu ya!` }, msg);
    } else {
      await sendQris(jid, order, msg);
    }
    return;
  }
  await notifyProof(order, expired, msg);
}

// Chat biasa dari nomor yang pernah memesan KUWERA diteruskan ke worker CS, kecuali admin baru membalas.
async function csInbox(msg) {
  const jid = msg.key.remoteJid;
  const m = msg.message || {};
  const media = m.imageMessage ? '[gambar]' : m.documentMessage ? '[dokumen]' : m.audioMessage ? '[pesan suara]'
    : m.videoMessage ? '[video]' : m.stickerMessage ? '[stiker]' : m.contactMessage ? '[kontak]' : m.locationMessage ? '[lokasi]' : '';
  const text = [media, textOf(msg).trim()].filter(Boolean).join(' ');
  if (!text || m.protocolMessage || m.reactionMessage || Date.now() - (humanAt.get(jid) || 0) < 30 * 60_000) return;
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
    order: rows.map((o) => ({ id: o.id, status: o.status, total: rupiah(o.total), tiket: o.quantity })) };
  fs.writeFileSync(`${INBOX}/${msg.key.id}.json`, JSON.stringify(item));
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
const buyerChat = (orderId, phone) => confirmChats[orderId] || phoneJid(phone);

// Pesan penolakan dari tool kuwera_tolak (cli.js) menunggu di /data/outbox sebagai file JSON.
async function processOutbox() {
  if (!connected) return;
  fs.mkdirSync(OUTBOX, { recursive: true });
  for (const f of fs.readdirSync(OUTBOX).filter((x) => x.endsWith('.json')).sort()) {
    const file = `${OUTBOX}/${f}`;
    const item = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (item.jid) { // balasan worker CS
      try { await reply(item.jid, { text: item.text }); } catch (e) { logger.error({ jid: item.jid, err: e.message }, 'gagal kirim balasan CS'); }
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
    if (!o.waNotifiedAt && connected) {
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
        `Race pack bisa diambil pada ${RACE_PACK}. Jam pengambilannya kami kabarkan lewat WhatsApp ini menjelang hari H. Jangan lupa bawa KTP atau KIA asli setiap peserta, ya.`,
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

async function paidLoop() {
  for (;;) {
    try { await processPaid(); } catch (e) { logger.error({ err: e.message }, 'proses order lunas gagal'); }
    try { await processOutbox(); } catch (e) { logger.error({ err: e.message }, 'proses outbox gagal'); }
    await sleep(20000);
  }
}

let pairingRequested = false;
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('/data/auth');
  const { version } = await fetchLatestBaileysVersion();
  const s = makeWASocket({ auth: state, version, logger: pino({ level: 'silent' }), browser: ['KUWERA 5K', 'Chrome', '1.0'] });
  s.ev.on('creds.update', saveCreds);
  s.ev.on('contacts.upsert', rememberContacts);
  s.ev.on('contacts.update', rememberContacts);
  s.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      // Belum tertaut: pakai kode 8 huruf (Perangkat tertaut > Tautkan dengan nomor telepon) kalau
      // PAIRING_PHONE diisi, dan simpan QR sebagai cadangan.
      QRCode.toFile('/data/latest-qr.png', qr, { width: 400 }).catch(() => {});
      if (PAIRING_PHONE && !pairingRequested) {
        pairingRequested = true;
        try {
          const code = await s.requestPairingCode(PAIRING_PHONE);
          fs.writeFileSync('/data/pairing-code.txt', `${code}\n${new Date().toISOString()}\n`);
          logger.info({ code }, 'kode tautan WhatsApp (masukkan di HP dalam beberapa menit)');
        } catch (e) {
          pairingRequested = false;
          logger.error({ err: e.message }, 'gagal meminta kode tautan');
        }
      }
    }
    if (connection === 'close') {
      connected = false;
      pairingRequested = false; // kode lama kedaluwarsa, sambungan berikutnya meminta kode baru
      const code = new Boom(lastDisconnect && lastDisconnect.error).output.statusCode;
      const again = code !== DisconnectReason.loggedOut;
      logger.warn({ statusCode: code, reconnect: again }, 'koneksi WhatsApp terputus');
      if (again) setTimeout(() => start().catch((e) => logger.error({ err: e.message }, 'gagal menyambung ulang')), 3000);
    } else if (connection === 'open') {
      sock = s;
      connected = true;
      pairingRequested = false;
      logger.info('bot KUWERA terhubung ke WhatsApp');
      // Sekali saja: tarik ulang app state supaya nama kontak dari HP kantor terkirim lewat contacts.upsert.
      if (!fs.existsSync('/data/contacts-synced')) {
        s.resyncAppState(['critical_unblock_low', 'regular_high', 'regular_low', 'critical_block', 'regular'], true)
          .then(() => { fs.writeFileSync('/data/contacts-synced', new Date().toISOString()); logger.info({ jumlah: Object.keys(contacts).length }, 'kontak tersinkron'); })
          .catch((e) => logger.warn({ err: e.message }, 'sinkron kontak gagal'));
      }
    }
  });
  s.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const m of messages) {
      if (!byHuman(m) || !m.key.remoteJid || m.key.remoteJid.endsWith('@g.us') || m.key.remoteJid === 'status@broadcast') continue;
      humanAt.set(m.key.remoteJid, Date.now());
      // Catat ke worker CS bahwa admin sudah membalas dari HP, supaya pengingat "belum dibalas" tidak muncul.
      fs.mkdirSync(INBOX, { recursive: true });
      fs.writeFileSync(`${INBOX}/admin-${m.key.id}.json`, JSON.stringify({ tipe: 'admin', id: m.key.id, bot: 'kuwera', jid: m.key.remoteJid,
        phone: digits(m.key.remoteJidAlt || m.key.remoteJid), text: textOf(m).slice(0, 300) || '[media]', waktu: Date.now() }));
    }
    if (type !== 'notify') return;
    for (const msg of messages) {
      try { await handleIncoming(msg); } catch (e) { logger.error({ err: e.message }, 'gagal memproses pesan masuk'); }
    }
  });
}

start().catch((e) => { logger.error({ err: e.message }, 'gagal start bot'); process.exit(1); });
paidLoop();
