// Penghubung ke WAHA (WhatsApp HTTP API) dengan bentuk antarmuka yang sama seperti soket Baileys yang dipakai bot ini:
// ev.on('messages.upsert' | 'connection.update'), sendMessage, sendPresenceUpdate, dan bentuk pesan { key, message, pushName }.
// Sesi WhatsApp (tautan QR) dipegang WAHA, bukan bot. Pesan masuk datang lewat webhook bertanda tangan HMAC sha512.
// JID pribadi tetap @s.whatsapp.net di sisi bot; WAHA memakai @c.us.
const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const keBot = (jid) => teksJid(jid).replace(/@c\.us$/, '@s.whatsapp.net');
const keWaha = (jid) => (jid || '').replace(/@s\.whatsapp\.net$/, '@c.us');
const idPolos = (id) => String(id || '').split('_')[2] || String(id || '');
// WEBJS kadang memberi jid sebagai objek { _serialized }, bukan teks.
const teksJid = (j) => (j && typeof j === 'object' ? j._serialized || '' : j || '');

// Pengganti BufferJSON Baileys, format sama ({ type: 'Buffer', data: base64 }) supaya berkas tunda lama tetap terbaca.
const BufferJSON = {
  replacer: (_k, v) => (v?.type === 'Buffer' && Array.isArray(v.data) ? { type: 'Buffer', data: Buffer.from(v.data).toString('base64') } : v),
  reviver: (_k, v) => (v?.type === 'Buffer' && typeof v.data === 'string' ? Buffer.from(v.data, 'base64') : v),
};

function makeWahaSock({ url = process.env.WAHA_URL || 'http://waha:3000', key = process.env.WAHA_API_KEY, session = process.env.WAHA_SESSION || 'superadmin',
  hmac = process.env.WEBHOOK_HMAC, port = Number(process.env.WEBHOOK_PORT || 3012), logger = console } = {}) {
  const ev = new EventEmitter();
  const lid = new Map(); // lid -> nomor (@s.whatsapp.net), supaya pencocokan order tetap memakai nomor HP
  let buka = false;

  async function api(jalur, isi, method) {
    const r = await fetch(`${url}${jalur}`, {
      method: method || (isi ? 'POST' : 'GET'),
      headers: { 'X-Api-Key': key, ...(isi ? { 'Content-Type': 'application/json' } : {}) },
      body: isi ? JSON.stringify(isi) : undefined,
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`WAHA ${jalur} ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r;
  }

  async function nomorDari(jid) {
    if (!jid?.endsWith('@lid')) return undefined;
    if (lid.has(jid)) return lid.get(jid);
    try {
      const d = await (await api(`/api/${session}/lids/${encodeURIComponent(jid)}`)).json();
      const pn = d.pn ? keBot(d.pn) : undefined;
      if (pn) lid.set(jid, pn);
      return pn;
    } catch { return undefined; }
  }

  // Payload WAHA (mesin WEBJS) -> bentuk pesan Baileys.
  async function kePesan(p) {
    const grup = (p.fromMe ? p.to : p.from)?.endsWith('@g.us');
    const remoteJid = keBot(p.fromMe ? p.to : p.from);
    const participant = grup && p.participant ? keBot(p.participant) : undefined;
    const tipe = p._data?.type || 'chat';
    const body = p.body || '';
    const ctx = p.replyTo ? { stanzaId: idPolos(p.replyTo.id) || p.replyTo.id, participant: keBot(p.replyTo.participant), quotedMessage: { conversation: p.replyTo.body || '' } } : undefined;
    let message;
    if (tipe === 'chat') message = ctx ? { extendedTextMessage: { text: body, contextInfo: ctx } } : { conversation: body };
    else if (tipe === 'image') message = { imageMessage: { caption: body, mimetype: p.media?.mimetype || p._data?.mimetype } };
    else if (tipe === 'document') message = { documentMessage: { caption: p._data?.caption || '', fileName: p.media?.filename || p._data?.filename, mimetype: p.media?.mimetype || p._data?.mimetype } };
    else if (tipe === 'ptt' || tipe === 'audio') message = { audioMessage: {} };
    else if (tipe === 'video') message = { videoMessage: { caption: body } };
    else if (tipe === 'sticker') message = { stickerMessage: {} };
    else if (tipe === 'vcard' || tipe === 'multi_vcard') message = { contactMessage: {} };
    else if (tipe === 'location') message = { locationMessage: {} };
    else return null; // reaksi, panggilan, pesan sistem
    return {
      key: { remoteJid, fromMe: !!p.fromMe, id: idPolos(p.id), wahaId: p.id, participant,
        remoteJidAlt: await nomorDari(remoteJid), participantAlt: await nomorDari(participant) },
      messageTimestamp: Number(p.timestamp) || 0,
      pushName: p._data?.notifyName || '',
      message,
      wahaMedia: p.media || null,
    };
  }

  function keadaan(st) {
    const kini = st === 'WORKING';
    if (kini === buka) return;
    buka = kini;
    // 401 hanya kalau WAHA sendiri melaporkan sesi gagal (perlu pindai ulang); selain itu WAHA menyambung ulang sendiri.
    ev.emit('connection.update', kini ? { connection: 'open' } : { connection: 'close', statusCode: st === 'FAILED' ? 401 : 503, status: st });
  }
  const cek = () => api(`/api/sessions/${session}`).then((r) => r.json()).then((d) => keadaan(d.status)).catch((e) => { logger.warn?.({ err: e.message }, 'WAHA tidak terjangkau'); keadaan('TIDAK_TERJANGKAU'); });

  http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook') { res.writeHead(404).end(); return; }
    const potong = [];
    req.on('data', (c) => potong.push(c));
    req.on('end', async () => {
      const badan = Buffer.concat(potong);
      const tanda = crypto.createHmac('sha512', hmac).update(badan).digest('hex');
      const kiriman = String(req.headers['x-webhook-hmac'] || '');
      if (kiriman.length !== tanda.length || !crypto.timingSafeEqual(Buffer.from(kiriman), Buffer.from(tanda))) { res.writeHead(401).end(); return; }
      res.writeHead(200).end('ok');
      try {
        const e = JSON.parse(badan);
        if (e.session !== session) return;
        if (e.event === 'session.status') keadaan(e.payload?.status);
        if (e.event === 'message.any') {
          const m = await kePesan(e.payload);
          if (m) ev.emit('messages.upsert', { messages: [m], type: 'notify' });
        }
      } catch (x) { logger.error?.({ err: x.message }, 'webhook WAHA gagal diolah'); }
    });
  }).listen(port, () => { cek(); setInterval(cek, 60000); });

  const berkas = (buf, mimetype, filename) => ({ mimetype, filename, data: Buffer.from(buf).toString('base64') });

  async function sendMessage(jid, content, opts) {
    const dasar = { session, chatId: keWaha(jid), ...(opts?.quoted?.key?.wahaId ? { reply_to: opts.quoted.key.wahaId } : {}) };
    let r;
    if (content.audio) r = await api('/api/sendVoice', { ...dasar, file: berkas(content.audio, content.mimetype || 'audio/ogg; codecs=opus') });
    else if (content.image) r = await api('/api/sendImage', { ...dasar, caption: content.caption, file: berkas(content.image, content.mimetype || 'image/png', 'gambar.png') });
    else if (content.document) r = await api('/api/sendFile', { ...dasar, caption: content.caption, file: berkas(content.document, content.mimetype || 'application/octet-stream', content.fileName) });
    else if (content.text != null) r = await api('/api/sendText', { ...dasar, text: content.text, ...(content.mentions ? { mentions: content.mentions.map(keWaha) } : {}) });
    else throw new Error(`jenis kiriman belum didukung lewat WAHA: ${Object.keys(content).join(',')}`);
    const d = await r.json().catch(() => ({}));
    const penuh = d.id?._serialized || d._data?.id?._serialized || d.id;
    return { key: { remoteJid: jid, fromMe: true, id: idPolos(penuh), wahaId: penuh } };
  }

  return {
    ev,
    sendMessage,
    presenceSubscribe: async () => {},
    sendPresenceUpdate: (jenis, jid) => api(jenis === 'composing' ? '/api/startTyping' : '/api/stopTyping', { session, chatId: keWaha(jid) }),
    groupFetchAllParticipating: async () => {
      const g = await (await api(`/api/${session}/groups`)).json();
      return Object.fromEntries((Array.isArray(g) ? g : Object.values(g)).map((x) => {
        const id = x.id?._serialized || x.JID || x.id;
        return [id, { id, subject: x.name || x.subject || x.Name || '' }];
      }));
    },
    groupUpdateDescription: (jid, description) => api(`/api/${session}/groups/${encodeURIComponent(jid)}/description`, { description }, 'PUT'),
    downloadMedia: async (msg) => {
      if (!msg.wahaMedia?.url) throw new Error('media tidak tersedia dari WAHA');
      return Buffer.from(await (await api(new URL(msg.wahaMedia.url).pathname)).arrayBuffer());
    },
  };
}

module.exports = { makeWahaSock, BufferJSON };
