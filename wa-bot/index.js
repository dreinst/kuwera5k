// Bot WhatsApp KUWERA 5K untuk bayar manual QRIS.
//
// 1. Pemesan menekan "Minta QRIS via WhatsApp" di /bayar dan mengirim pesan berisi nomor order ke nomor
//    kantor. Bot membalas dengan kartu bayar (QRIS dinamis bernominal total, dari /api/orders/{id}/qris).
//    Setelah pemesan mengirim screenshot bukti bayar, bot meneruskan ke Telegram superadmin (@dproagentbot)
//    kartu invoice yang sama dengan milik pemesan plus foto bukti bayarnya. Keterangan foto bukti memuat nomor
//    order, jadi superadmin cukup me-reply foto itu dengan "ok" (Hermes membaca keterangan foto yang di-reply).
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
const REAL_GATEWAYS = ['qris-manual', 'midtrans'];
const ORDER_RE = /KWR-\d{4}-[A-Z0-9]{6}/i;
const CONFIRM_FILE = '/data/konfirmasi.json';
const OUTBOX = '/data/outbox';
const PROOF_FILE = '/data/telegram-bukti.json'; // order -> message_id foto bukti di Telegram
// Sama dengan src/lib/event-data.ts (racePackDates, racePackPlace, jadwal lomba).
const RACE_PACK = 'Kamis dan Jumat, 22 dan 23 Oktober 2026 di Lapangan Rampal (tenda panitia)';
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
  if (!match) {
    // Screenshot bukti bayar yang dikirim menyusul (tanpa nomor order) di chat yang sudah konfirmasi.
    const pending = hasProof && Object.keys(confirmChats).find((id) => confirmChats[id] === jid);
    if (pending && !recent(`${jid}|${pending}|bukti`)) {
      const o = await loadOrder(pending);
      if (o && o.status !== 'PAID') await notifyProof(o, o.status !== 'PENDING' || (o.expiresAt && new Date(o.expiresAt) <= new Date()), msg);
    }
    return; // chat biasa dibalas admin manusia
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
      await reply(jid, { text: `Waktu bayar order ${order.id} sudah habis. Silakan daftar ulang di ${SITE_URL}/daftar` }, msg);
    } else {
      await sendQris(jid, order, msg);
    }
    return;
  }
  await notifyProof(order, expired, msg);
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
    await telegram(`KUWERA 5K: kartu QRIS order ${order.id} gagal dibuat. Balas pemesan manual di WA kantor.`);
    return;
  }
  const deadline = order.expiresAt
    ? new Date(order.expiresAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null;
  const caption = [
    `QRIS pembayaran order ${order.id}`,
    `Nominal: ${rupiah(order.total)} (${order.quantity} tiket)`,
    '',
    'Scan dari aplikasi bank atau e-wallet apa pun. Nominal sudah terisi otomatis, bayar persis sesuai angka itu.',
    `Setelah bayar, kirim screenshot bukti bayar di chat ini.${deadline ? ` Batas bayar ${deadline} WIB.` : ''}`,
  ].join('\n');
  await reply(jid, { image, caption }, quoted);
}

// Ke Telegram superadmin: kartu invoice yang sama dengan milik pemesan, lalu foto bukti bayarnya. Nomor order
// ada di keterangan foto bukti, jadi cukup reply foto itu dengan "ok" untuk menyetujui.
async function notifyProof(order, expired, msg) {
  const card = order.status === 'PENDING' ? await qrisCard(order.id) : null;
  if (card) await telegramFile('photo', card, `invoice-${order.id}.png`, `Invoice yang dikirim ke pemesan ${order.buyer || '-'}, order ${order.id}`);
  const caption = [
    `KUWERA 5K: bukti bayar order ${order.id}${expired ? ' (waktu bayar sudah habis)' : ''}`,
    `Pemesan: ${order.buyer || '-'}, ${order.quantity} tiket`,
    `Nominal yang harus masuk: ${rupiah(order.total)}`,
    '',
    'Cek riwayat GoPay Merchant. Kalau nominalnya persis masuk, reply foto ini dengan: ok',
    'Kalau belum ada, reply dengan: tolak <alasan>',
    `Bisa juga lewat ${SITE_URL}/kuweraadmin/peserta/${order.id}`,
  ].join('\n');
  const media = msg.message?.imageMessage ? 'photo' : msg.message?.documentMessage ? 'document' : null;
  let buffer = null;
  if (media) {
    try { buffer = await downloadMediaMessage(msg, 'buffer', {}); } catch (e) { logger.error({ orderId: order.id, err: e.message }, 'gagal mengunduh bukti bayar'); }
  }
  const name = media === 'document' ? msg.message.documentMessage.fileName || `bukti-${order.id}` : `bukti-${order.id}.jpg`;
  const messageId = buffer
    ? await telegramFile(media, buffer, name, caption)
    : await telegram(`${caption}\n\n(Gambar bukti gagal diteruskan, lihat di chat WA kantor.)`).then(() => null);
  if (messageId) {
    proofMessages[order.id] = messageId;
    saveProofMessages();
  }
}

// Pesan penolakan dari tool kuwera_tolak (cli.js) menunggu di /data/outbox sebagai file JSON.
async function processOutbox() {
  if (!connected) return;
  fs.mkdirSync(OUTBOX, { recursive: true });
  for (const f of fs.readdirSync(OUTBOX).filter((x) => x.endsWith('.json')).sort()) {
    const file = `${OUTBOX}/${f}`;
    const item = JSON.parse(fs.readFileSync(file, 'utf8'));
    const targets = new Set([phoneJid(item.phone), confirmChats[item.orderId]].filter(Boolean));
    for (const jid of targets) {
      try { await reply(jid, { text: item.text }); } catch (e) { logger.error({ jid, err: e.message }, 'gagal kirim pesan outbox'); }
    }
    fs.unlinkSync(file);
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
        'Nomor QR registrasi ulang (tunjukkan saat ambil race pack):',
        ...tickets.map((t, i) => `${i + 1}. ${t.fullName}: ${t.code}`),
        '',
        `E-ticket lengkap: ${SITE_URL}/tiket/${o.id}`,
        '',
        `Ambil race pack: ${RACE_PACK}. Bawa KTP atau KIA asli tiap peserta.`,
        `Hari lomba: ${RACE_DAY}.`,
        '',
        'QR tiap peserta kami kirim di bawah ini. Simpan baik-baik.',
      ].join('\n');
      const targets = new Set([phoneJid(o.buyerPhone), confirmChats[o.id]].filter(Boolean));
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
      delete confirmChats[o.id];
      saveConfirmChats();
    }
    if (!o.adminNotifiedAt) {
      const sum = await incomeSummary();
      await telegram([
        'KUWERA 5K: pembayaran terverifikasi',
        `Order ${o.id}, ${o.quantity} tiket, ${rupiah(o.total)}`,
        `Pemesan: ${o.buyer || '-'}`,
        `Disetujui: ${o.gateway === 'qris-manual' ? `${o.verified_by || 'admin'} lewat ${o.verified_via === 'telegram' ? 'Telegram' : 'halaman admin'}` : o.gateway}, ${wib(o.paidAt)}`,
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
    }
  });
  s.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try { await handleIncoming(msg); } catch (e) { logger.error({ err: e.message }, 'gagal memproses pesan masuk'); }
    }
  });
}

start().catch((e) => { logger.error({ err: e.message }, 'gagal start bot'); process.exit(1); });
paidLoop();
