// Perintah untuk chatbot Hermes (plugin hermes-plugin/kuwera), dijalankan lewat
// `docker exec kuwera-wa-bot node cli.js <perintah> ...`. Keluaran selalu satu baris JSON.
//
//   menunggu                     order yang menunggu konfirmasi bayar
//   setujui <order> <oleh>       tandai lunas + terbitkan tiket (bot lalu mengirim e-ticket ke WhatsApp)
//   tolak <order> <oleh> <alasan>  kirim pesan ke pemesan bahwa pembayaran belum ditemukan
//   pemasukan                    total pemasukan terverifikasi
//
// "setujui" meniru markOrderPaid di src/lib/orders.ts: status PAID, satu Payment qris-manual, satu tiket
// per peserta dengan kode {order}-{urutan} dan QR yang sama dengan buatan website.

const fs = require('node:fs');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const QRCode = require('qrcode');

const ORDER_RE = /^KWR-\d{4}-[A-Z0-9]{6}$/;
const caFile = process.env.DB_SSL_CA_FILE;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: caFile ? { ca: fs.readFileSync(caFile, 'utf8'), rejectUnauthorized: true } : undefined,
});
const rupiah = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
const id = () => 'c' + crypto.randomBytes(12).toString('hex');
const confirmChats = () => { try { return JSON.parse(fs.readFileSync('/data/konfirmasi.json', 'utf8')); } catch { return {}; } };

async function menunggu() {
  const { rows } = await pool.query(
    `SELECT o.id, o.total, o.quantity, o.status, o."expiresAt" < timezone('UTC', now()) AS lewat_batas,
            (SELECT p."fullName" FROM "Participant" p WHERE p."orderId" = o.id ORDER BY p.position LIMIT 1) AS pemesan
       FROM "Order" o
      WHERE o.status IN ('PENDING', 'EXPIRED') AND o."uniqueCode" > 0
        AND o."createdAt" > timezone('UTC', now()) - interval '3 days'
      ORDER BY o."createdAt" DESC LIMIT 30`,
  );
  const chats = confirmChats();
  return rows.map((r) => ({ ...r, total: rupiah(r.total), sudah_konfirmasi_wa: !!chats[r.id] }));
}

async function pemasukan() {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS pembelian, coalesce(sum(o.quantity), 0)::int AS tiket, coalesce(sum(o.total), 0)::bigint AS total
       FROM "Order" o
      WHERE o.status = 'PAID'
        AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."orderId" = o.id AND p.gateway IN ('qris-manual', 'midtrans'))`,
  );
  return { ...rows[0], total: rupiah(rows[0].total) };
}

async function setujui(orderId, oleh) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE "Order" SET status = 'PAID', "paidAt" = timezone('UTC', now()), "updatedAt" = timezone('UTC', now())
        WHERE id = $1 AND status IN ('PENDING', 'EXPIRED') RETURNING id, total, quantity, "promoCode", status`,
      [orderId],
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      const cur = await client.query('SELECT status FROM "Order" WHERE id = $1', [orderId]);
      return { ok: false, pesan: cur.rows.length ? `Order ${orderId} berstatus ${cur.rows[0].status}, tidak bisa disetujui` : `Order ${orderId} tidak ditemukan` };
    }
    const o = rows[0];
    await client.query(
      `INSERT INTO "Payment" (id, "orderId", gateway, "gatewayRef", method, amount, "rawPayload", "receivedAt")
       VALUES ($1, $2, 'qris-manual', NULL, 'qris', $3, $4, timezone('UTC', now()))`,
      [id(), o.id, o.total, JSON.stringify({ verifiedBy: oleh, via: 'telegram', verifiedAt: new Date().toISOString() })],
    );
    if (o.promoCode) await client.query('UPDATE "PromoCode" SET "usedCount" = "usedCount" + 1 WHERE code = $1', [o.promoCode]);
    const people = await client.query('SELECT id, position FROM "Participant" WHERE "orderId" = $1 ORDER BY position', [o.id]);
    for (const p of people.rows) {
      const code = `${o.id}-${p.position}`;
      const qrSvg = await QRCode.toString(code, { type: 'svg', margin: 1, color: { dark: '#0B4A2C', light: '#FFFFFF' } });
      await client.query(
        `INSERT INTO "Ticket" (id, "orderId", "participantId", code, "qrSvg", "createdAt")
         VALUES ($1, $2, $3, $4, $5, timezone('UTC', now())) ON CONFLICT ("participantId") DO NOTHING`,
        [id(), o.id, p.id, code, qrSvg],
      );
    }
    await client.query('COMMIT');
    return { ok: true, pesan: `Order ${o.id} disetujui: ${o.quantity} tiket, ${rupiah(o.total)}. Bot mengirim e-ticket ke WhatsApp pemesan dalam kurang dari satu menit.` };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function tolak(orderId, oleh, alasan) {
  const { rows } = await pool.query('SELECT id, status, total, "buyerPhone" FROM "Order" WHERE id = $1', [orderId]);
  if (!rows.length) return { ok: false, pesan: `Order ${orderId} tidak ditemukan` };
  const o = rows[0];
  if (o.status === 'PAID') return { ok: false, pesan: `Order ${orderId} sudah lunas, tidak bisa ditolak` };
  const text = [
    `Mohon maaf, pembayaran untuk order ${o.id} (${rupiah(o.total)}) belum kami temukan.`,
    alasan ? `Catatan admin: ${alasan}` : '',
    '',
    'Pastikan nominal yang dibayar persis sama dengan total di halaman pembayaran, lalu kirim ulang screenshot bukti bayarnya di chat ini.',
  ].filter((x, i) => x || i === 2).join('\n');
  fs.mkdirSync('/data/outbox', { recursive: true });
  fs.writeFileSync(`/data/outbox/${Date.now()}-${o.id}.json`, JSON.stringify({ orderId: o.id, phone: o.buyerPhone, text, oleh }));
  return { ok: true, pesan: `Pesan penolakan untuk ${o.id} dikirim bot ke WhatsApp pemesan dalam kurang dari satu menit.` };
}

(async () => {
  const [cmd, orderRaw, oleh = 'superadmin', ...rest] = process.argv.slice(2);
  const orderId = (orderRaw || '').trim().toUpperCase();
  let out;
  if (cmd === 'menunggu') out = await menunggu();
  else if (cmd === 'pemasukan') out = await pemasukan();
  else if ((cmd === 'setujui' || cmd === 'tolak') && !ORDER_RE.test(orderId)) out = { ok: false, pesan: 'Format nomor order harus KWR-2026-XXXXXX' };
  else if (cmd === 'setujui') out = await setujui(orderId, oleh);
  else if (cmd === 'tolak') out = await tolak(orderId, oleh, rest.join(' ').slice(0, 200));
  else out = { ok: false, pesan: 'Perintah: menunggu | pemasukan | setujui <order> <oleh> | tolak <order> <oleh> <alasan>' };
  process.stdout.write(JSON.stringify(out) + '\n');
  await pool.end();
})().catch(async (e) => {
  process.stdout.write(JSON.stringify({ ok: false, pesan: `Gagal: ${e.message}` }) + '\n');
  await pool.end().catch(() => {});
  process.exit(1);
});
