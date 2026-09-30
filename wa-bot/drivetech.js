// Bayar manual DriveTech lewat bot WhatsApp kantor yang sama (keputusan pemilik 2026-09-29: satu nomor, satu bot).
//
// 1. Penyewa menekan "Minta QRIS via WhatsApp" di halaman bayar DriveTech; pesannya berisi kode booking BK-XXXXXXXXXX.
//    Bot membalas dengan kartu QRIS dinamis (nominal = biaya admin + kode unik 350..500) dari /api/qris/{kode}.
// 2. Screenshot bukti bayar (dengan kode booking di keterangan, atau menyusul di chat yang sama) diunggah ke
//    /api/bot/booking/{kode}/bukti lalu diteruskan ke Discord #chatbot dengan tombol Setujui/Tolak
//    (custom_id drivetech:setujui:{kode}); tombolnya ditangani bot D'Pro Ops di VPS.
// 3. Kabar verifikasi, penolakan, pembatalan, dan pengingat bayar diambil dari /api/bot/outbox dan hanya dikirim
//    ke chat yang pernah menghubungi bot, jadi nomor kantor tidak pernah mengirim pesan pertama.
//
// Semua data DriveTech ada di aplikasinya (Supabase); bot hanya memanggil API dengan header x-bot-key.

const fs = require('node:fs');

const BOOKING_RE = /BK-[0-9A-F]{10}/i;
const API = (process.env.DRIVETECH_URL || 'https://drive-tech-sigma.vercel.app').replace(/\/$/, '');
const KEY = process.env.DRIVETECH_BOT_KEY || '';
const CHAT_FILE = process.env.DRIVETECH_CHAT_FILE || '/data/drivetech-chat.json'; // jid -> kode booking terakhir yang dibahas di chat itu

module.exports = function drivetech(deps) {
  // deps() dipanggil saat dipakai supaya fungsi dan konstanta index.js sudah terdefinisi.
  let chats = {};
  try { chats = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8')); } catch { chats = {}; }
  const saveChats = () => fs.writeFileSync(CHAT_FILE, JSON.stringify(chats));

  async function api(path, { method = 'GET', json, body, type } = {}) {
    const headers = { 'x-bot-key': KEY };
    if (json) headers['content-type'] = 'application/json';
    if (type) headers['content-type'] = type;
    const res = await fetch(`${API}${path}`, {
      method, headers, body: json ? JSON.stringify(json) : body, signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function kartu(kode) {
    const res = await fetch(`${API}/api/qris/${kode}`, { signal: AbortSignal.timeout(30000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }

  const menunggu = (b) => b.status === 'pending_payment' && b.statusBayar !== 'verified' && !b.lewatBatas;

  async function kirimQris(jid, b, quoted) {
    const { reply, notify } = deps();
    const image = await kartu(b.kode);
    if (!image) {
      await notify(`DriveTech: kartu QRIS booking ${b.kode} gagal dibuat. Mohon balas penyewa manual di WA kantor.`);
      return;
    }
    const caption = [
      `QRIS pembayaran booking DriveTech ${b.kode}`,
      `Lapak ${b.lapak}, ${b.tanggal.join(', ')}`,
      `Nominal: ${b.totalTeks} (biaya admin + kode unik)`,
      '',
      'Silakan pindai dengan aplikasi bank atau e-wallet berlogo QRIS. Nominalnya sudah terisi otomatis, mohon dibayar sesuai angka itu.',
      `Setelah membayar, kirimkan screenshot buktinya di chat ini.${b.batasTeks ? ` Kami tunggu pembayarannya sebelum ${b.batasTeks}.` : ''}`,
      'Pembayaran diverifikasi manual oleh panitia, kabarnya kami kirim ke chat ini dan ke email Anda.',
    ].join('\n');
    await reply(jid, { image, caption }, quoted);
  }

  async function teruskanBukti(jid, b, msg) {
    const { reply, mediaOf, discord, notify, logger } = deps();
    const media = await mediaOf(msg);
    const tipe = media && (media.mime || '').split(';')[0];
    if (!media || !['image/jpeg', 'image/png', 'image/webp'].includes(tipe)) {
      await reply(jid, { text: `Mohon kirim bukti bayar booking ${b.kode} berupa gambar (screenshot), ya. Terima kasih 🙏` }, msg);
      return;
    }
    const up = await api(`/api/bot/booking/${b.kode}/bukti`, { method: 'POST', body: media.buffer, type: tipe });
    if (up.status !== 200) {
      logger.error({ kode: b.kode, status: up.status, err: up.data?.error }, 'DriveTech: bukti gagal disimpan');
      await notify(`DriveTech: bukti bayar ${b.kode} dari WhatsApp gagal disimpan (${up.status} ${up.data?.error || ''}). Cek manual di WA kantor.`);
    }
    const isi = [
      `**Bukti bayar DriveTech** ${b.kode}`,
      `Penyewa: ${b.nama} (${b.hp || '-'})`,
      `Lapak: ${b.lapak}`,
      `Tanggal: ${b.tanggal.join(', ')}`,
      `Nominal yang harus masuk: **${b.totalTeks}** (kode unik ${b.kodeUnik ?? '-'})`,
      up.status === 200 ? 'Bukti sudah tersimpan di /admin DriveTech.' : 'Bukti BELUM tersimpan di sistem, cek manual.',
      'Cocokkan dengan riwayat GoPay Merchant, lalu pilih Setujui atau Tolak.',
    ].join('\n');
    try {
      await discord(isi, { files: [{ buffer: media.buffer, name: `bukti-${b.kode}.${tipe.split('/')[1]}` }], approve: b.kode, approvePrefix: 'drivetech' });
    } catch (e) {
      logger.warn({ err: e.message }, 'DriveTech: Discord gagal, kirim ke Telegram');
      await notify(`${isi}\nSetujui dari /admin/bookings DriveTech.`);
    }
    await reply(jid, { text: `Terima kasih, ${b.nama}! Bukti bayar booking ${b.kode} sudah kami terima dan sedang dicek panitia. Kabarnya kami kirim ke chat ini setelah pembayaran dikonfirmasi 😊` }, msg);
  }

  // true = pesan ini urusan DriveTech dan sudah ditangani; false = teruskan ke alur KUWERA/CS.
  async function handle(msg) {
    if (!KEY) return false;
    const { reply, textOf, recent, PAID_CLAIM } = deps();
    const jid = msg.key.remoteJid;
    const text = textOf(msg);
    const hasProof = !!(msg.message && (msg.message.imageMessage || msg.message.documentMessage));
    const match = text.match(BOOKING_RE);
    const kode = match ? match[0].toUpperCase() : chats[jid];
    if (!kode) return false;
    if (!match && !hasProof && !PAID_CLAIM.test(text)) return false; // chat biasa: biar worker CS yang menjawab

    const info = await api(`/api/bot/booking/${kode}`, { method: 'POST', json: { chat: jid } });
    if (info.status === 404 || info.status === 400) {
      if (!match) { delete chats[jid]; saveChats(); return false; }
      await reply(jid, { text: `Mohon maaf, kode booking ${kode} tidak kami temukan. Mohon cek lagi kodenya di email atau halaman status booking DriveTech, ya.` }, msg);
      return true;
    }
    if (info.status !== 200) throw new Error(`API DriveTech ${info.status}: ${info.data?.error || ''}`);
    const b = info.data;
    // Chat yang hanya terpetakan (tanpa kode di pesan) dan bookingnya sudah selesai: bukan urusan DriveTech lagi.
    if (!match && !menunggu(b)) return false;
    chats[jid] = b.kode;
    saveChats();

    if (recent(`${jid}|${b.kode}${hasProof ? '|bukti' : ''}`)) return true;
    if (b.status === 'confirmed' || b.statusBayar === 'verified') {
      await reply(jid, { text: `Pembayaran booking ${b.kode} sudah terverifikasi dan booking Anda terkonfirmasi. Tunjukkan kode booking saat registrasi ulang di lokasi ya.` }, msg);
      return true;
    }
    if (b.status === 'cancelled' || b.lewatBatas) {
      await reply(jid, { text: `Mohon maaf, batas waktu bayar booking ${b.kode} sudah lewat sehingga booking dibatalkan. Anda bisa memesan lapak lagi di ${API} kapan saja.` }, msg);
      return true;
    }
    if (hasProof) await teruskanBukti(jid, b, msg);
    else if (PAID_CLAIM.test(text) && !match) {
      await reply(jid, { text: b.punyaBukti
        ? `Terima kasih! Bukti bayar booking ${b.kode} sudah kami terima dan sedang dicek panitia.`
        : `Terima kasih! Supaya pembayaran booking ${b.kode} (${b.totalTeks}) bisa langsung dicek, mohon kirimkan screenshot bukti bayarnya di chat ini ya 🙏` }, msg);
    } else await kirimQris(jid, b, msg);
    return true;
  }

  // Kirim kabar dari outbox DriveTech (verifikasi, penolakan, pembatalan, pengingat). Dipanggil paidLoop tiap 20 detik.
  async function tick() {
    const { reply, isConnected, logger } = deps();
    if (!KEY || !isConnected()) return;
    const { status, data } = await api('/api/bot/outbox');
    if (status !== 200) throw new Error(`outbox DriveTech ${status}`);
    for (const m of data.pesan || []) {
      try {
        await reply(m.chat, { text: m.text });
        await api('/api/bot/outbox', { method: 'POST', json: { id: m.id, ok: true } });
        logger.info({ kode: m.kode, jenis: m.jenis }, 'DriveTech: kabar terkirim');
      } catch (e) {
        await api('/api/bot/outbox', { method: 'POST', json: { id: m.id, ok: false, error: e.message } });
        logger.error({ kode: m.kode, err: e.message }, 'DriveTech: kabar gagal dikirim');
      }
    }
  }

  return { handle, tick };
};
