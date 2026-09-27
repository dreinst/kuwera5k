// Bot WhatsApp KUWERA 5K untuk bayar manual QRIS.
//
// 1. Pemesan menekan "Konfirmasi pembayaran via WhatsApp" di /bayar, lalu mengirim pesan berisi nomor order
//    ke nomor kantor. Bot membalas dengan kartu bayar (QRIS bernominal total pembelian, satu gambar untuk
//    semua tiket) dan mengabari superadmin lewat Telegram supaya pembayaran dicek di GoPay Merchant.
// 2. Setelah admin menandai lunas di /admin, bot mengirim tautan e-ticket ke nomor pemesan dan mengabari
//    superadmin bahwa pembayaran sudah terverifikasi, lengkap dengan total pemasukan KUWERA.
//
// Bot hanya membalas chat yang memuat nomor order (pembeli yang menghubungi lebih dulu), jadi tidak ada
// pesan massal. Nomor yang sama dipakai bot Pet Blessing sebagai perangkat tertaut lain; bot itu tidak
// membaca pesan masuk, jadi keduanya tidak saling bentrok.

const fs = require('node:fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
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

async function telegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return logger.warn('Telegram belum diatur, notifikasi dilewati');
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
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
const lastReply = new Map(); // "{chat}|{order}" -> waktu balasan terakhir, supaya pesan beruntun tidak dibalas berulang

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
  const match = textOf(msg).match(ORDER_RE);
  if (!match) return; // chat biasa dibalas admin manusia
  const orderId = match[0].toUpperCase();
  const key = `${jid}|${orderId}`;
  if (Date.now() - (lastReply.get(key) || 0) < 10 * 60_000) return;
  lastReply.set(key, Date.now());

  const order = await loadOrder(orderId);
  if (!order) {
    await reply(jid, { text: `Nomor order ${orderId} tidak kami temukan. Cek lagi nomornya di halaman pembayaran, atau tunggu admin membalas chat ini.` }, msg);
    return;
  }
  if (order.status === 'PAID') {
    await reply(jid, { text: `Pembayaran order ${order.id} sudah terkonfirmasi. E-ticket kamu: ${SITE_URL}/tiket/${order.id}` }, msg);
    return;
  }

  confirmChats[order.id] = jid;
  saveConfirmChats();
  const expired = order.status !== 'PENDING' || (order.expiresAt && new Date(order.expiresAt) <= new Date());
  if (order.status === 'PENDING' && !expired) {
    const res = await fetch(`${SITE_URL}/api/orders/${order.id}/qris`, { signal: AbortSignal.timeout(20000) });
    const caption = [
      `Terima kasih, konfirmasi order ${order.id} sudah kami terima.`,
      '',
      `Jumlah tiket: ${order.quantity}`,
      `Total bayar: ${rupiah(order.total)}`,
      '',
      'Kalau belum bayar, scan QRIS di gambar ini (nominal sudah terisi otomatis) lalu kirim screenshot bukti bayarnya di chat ini.',
      'Admin akan mengecek pembayaran, lalu tautan e-ticket kami kirim ke WhatsApp ini.',
    ].join('\n');
    if (res.ok) await reply(jid, { image: Buffer.from(await res.arrayBuffer()), caption }, msg);
    else await reply(jid, { text: caption.replace('scan QRIS di gambar ini (nominal sudah terisi otomatis)', `scan QRIS di halaman ${SITE_URL}/bayar/${order.id}`) }, msg);
  } else {
    await reply(jid, { text: `Waktu bayar order ${order.id} sudah habis. Kalau kamu sudah membayar, kirim screenshot bukti bayarnya di chat ini dan admin akan mengeceknya.` }, msg);
  }
  await telegram([
    'KUWERA 5K: konfirmasi bayar masuk',
    `Order ${order.id}${expired ? ' (waktu bayar sudah habis)' : ''}`,
    `Pemesan: ${order.buyer || '-'}`,
    `Jumlah tiket: ${order.quantity}`,
    `Nominal yang harus masuk: ${rupiah(order.total)}`,
    '',
    'Cek riwayat GoPay Merchant, lalu tandai lunas di:',
    `${SITE_URL}/admin/peserta/${order.id}`,
  ].join('\n')).catch((e) => logger.error({ err: e.message }, 'Telegram konfirmasi gagal'));
}

// Order yang baru ditandai lunas: kirim tautan tiket ke pemesan, lalu kabari superadmin.
async function processPaid() {
  const { rows } = await pool.query(
    `SELECT o.id, o.total, o.quantity, o."paidAt", o."buyerPhone", o."waNotifiedAt", o."adminNotifiedAt",
            (SELECT p."fullName" FROM "Participant" p WHERE p."orderId" = o.id ORDER BY p.position LIMIT 1) AS buyer,
            (SELECT p."rawPayload"->>'verifiedBy' FROM "Payment" p WHERE p."orderId" = o.id ORDER BY p."receivedAt" DESC LIMIT 1) AS verified_by,
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
      const text = [
        `Pembayaran order ${o.id} sudah kami terima. Terima kasih!`,
        '',
        `E-ticket (${o.quantity} tiket): ${SITE_URL}/tiket/${o.id}`,
        '',
        'Simpan tautan ini dan tunjukkan QR tiap peserta saat ambil race pack. Bawa KTP atau KIA asli.',
      ].join('\n');
      const targets = new Set([phoneJid(o.buyerPhone), confirmChats[o.id]].filter(Boolean));
      for (const jid of targets) {
        try { await reply(jid, { text }); } catch (e) { logger.error({ id: o.id, jid, err: e.message }, 'gagal kirim tiket'); }
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
        `Dikonfirmasi: ${o.gateway === 'qris-manual' ? o.verified_by || 'admin' : o.gateway}, ${wib(o.paidAt)}`,
        '',
        `Total pemasukan terverifikasi: ${rupiah(sum.total)}`,
        `${sum.tickets} tiket dari ${sum.orders} pembelian`,
      ].join('\n'));
      await pool.query(`UPDATE "Order" SET "adminNotifiedAt" = timezone('UTC', now()) WHERE id = $1`, [o.id]);
    }
  }
}

async function paidLoop() {
  for (;;) {
    try { await processPaid(); } catch (e) { logger.error({ err: e.message }, 'proses order lunas gagal'); }
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
