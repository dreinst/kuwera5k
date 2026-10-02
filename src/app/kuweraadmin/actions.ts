"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { FINANCE, LOGIN_ERROR, SCAN, SUPER, allowed, attemptLogin, clientIp, deviceName, endSession, getAdmin, hashPassword, homeFor, logAdmin, sha256 } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { checkOrderWithMidtrans, type MidtransCheck } from "@/lib/admin-data";
import { MANUAL_GATEWAY, ORDER_LOCK_KEY, getSettings, heldCount, markOrderPaid, newOrderId, syncOrderWithMidtrans } from "@/lib/orders";
import { JERSEY_SIZES, normalizePhone, titleName } from "@/lib/registration";
import { verifyTurnstile } from "@/lib/turnstile";
import type { Pricing } from "@/lib/pricing";
import { PENARIKAN_KEY, getPenarikan } from "@/lib/penarikan";

// Server action = endpoint publik: setiap aksi memeriksa sesi dan perannya sendiri.

export type FormState = { error?: string; ok?: string } | null;

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!(await rateLimit("admin-login", 10, 900))) return { error: "Terlalu banyak percobaan dari jaringan ini. Coba lagi 15 menit lagi." };
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), await clientIp()))) {
    return { error: "Verifikasi bukan robot gagal. Centang ulang kotaknya." };
  }
  if (!username || !password) return { error: "Isi username dan kata sandi" };
  // Format username dicek dulu supaya isian aneh tidak ikut tercatat di log.
  if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length > 200) return { error: LOGIN_ERROR };
  const res = await attemptLogin(username, password);
  if (!res.ok) return { error: res.message };
  redirect(homeFor(res.role));
}

export async function logoutAction() {
  const admin = await getAdmin();
  if (admin) await logAdmin(admin.username, "logout", await deviceName());
  await endSession(admin?.id);
  redirect("/kuweraadmin/login");
}

export async function setupPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 10) return { error: "Kata sandi minimal 10 karakter" };
  if (password !== confirm) return { error: "Konfirmasi kata sandi tidak sama" };
  const user = token ? await prisma.adminUser.findUnique({ where: { setupTokenHash: sha256(token) } }) : null;
  if (!user || !user.setupExpires || user.setupExpires < new Date()) return { error: "Link sudah tidak berlaku. Minta link baru ke admin." };
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), setupTokenHash: null, setupExpires: null, failedLogins: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
  });
  await logAdmin(user.username, "atur_sandi");
  return { ok: "Kata sandi tersimpan. Silakan masuk." };
}

const orderForCheck = (id: string) =>
  prisma.order.findUnique({ where: { id }, select: { id: true, status: true, total: true, paymentMethod: true, expiresAt: true, payments: { select: { gateway: true } } } });

// Cek satu order ke Midtrans (superadmin dan admin keuangan).
export async function checkMidtransAction(orderId: string): Promise<MidtransCheck | { error: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, FINANCE)) return { error: "Sesi habis, masuk lagi" };
  const order = await orderForCheck(orderId);
  if (!order) return { error: "Order tidak ditemukan" };
  await logAdmin(admin.username, "cek_midtrans", orderId);
  return checkOrderWithMidtrans(order);
}

// Terapkan status resmi Midtrans ke order yang belum final (jalur yang sama dengan webhook).
export async function syncMidtransAction(orderId: string): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, FINANCE)) return { error: "Sesi habis, masuk lagi" };
  const order = await orderForCheck(orderId);
  if (!order) return { error: "Order tidak ditemukan" };
  if (order.status !== "PENDING" && order.status !== "FAILED") return { error: "Hanya order yang menunggu bayar atau gagal yang bisa disinkronkan" };
  const r = await syncOrderWithMidtrans(order);
  await logAdmin(admin.username, "sinkron_midtrans", `${orderId} ${order.status}->${r.status}`);
  revalidatePath(`/kuweraadmin/peserta/${orderId}`);
  if (r.live === "error") return { error: `Midtrans tidak bisa dihubungi: ${r.detail ?? ""}` };
  if (r.mismatch) return { error: "Nominal di Midtrans berbeda dengan total order, status tidak diubah" };
  return { ok: `Status sekarang: ${r.status}` };
}

export async function racepackAction(ticketCode: string, undo = false): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SCAN)) return { error: "Hanya petugas race pack yang bisa menandai" };
  if (undo && !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa membatalkan" };
  const ticket = await prisma.ticket.findUnique({ where: { code: ticketCode }, include: { order: { select: { status: true } } } });
  if (!ticket || ticket.order.status !== "PAID") return { error: "Order ini belum lunas atau belum punya tiket" };
  if (!undo && ticket.racepackCollectedAt) return { error: "Race pack sudah diambil sebelumnya" };
  await prisma.ticket.update({
    where: { code: ticketCode },
    data: undo ? { racepackCollectedAt: null, collectedBy: null } : { racepackCollectedAt: new Date(), collectedBy: admin.username },
  });
  await logAdmin(admin.username, undo ? "racepack_batal" : "racepack_ambil", ticketCode);
  revalidatePath(`/kuweraadmin/peserta/${ticket.orderId}`);
  revalidatePath("/kuweraadmin/regulang");
  return { ok: undo ? "Tanda ambil race pack dibatalkan" : "Race pack ditandai sudah diambil" };
}

// Verifikasi massal: semua order yang pernah membuka Midtrans atau tercatat lunas, dicocokkan satu per satu.
export async function verifyAllAction(): Promise<{ results?: MidtransCheck[]; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa menjalankan verifikasi massal" };
  const orders = await prisma.order.findMany({
    where: { OR: [{ snapToken: { not: null } }, { status: "PAID" }] },
    select: { id: true, status: true, total: true, payments: { select: { gateway: true } } },
    orderBy: { createdAt: "desc" },
  });
  const results: MidtransCheck[] = [];
  for (let i = 0; i < orders.length; i += 4) {
    results.push(...(await Promise.all(orders.slice(i, i + 4).map(checkOrderWithMidtrans))));
  }
  await logAdmin(admin.username, "verifikasi_massal", `${orders.length} order`);
  return { results };
}

// Konfirmasi bayar manual (QRIS GoPay Merchant): admin sudah melihat uang masuk dengan nominal persis
// sama di aplikasi GoPay Merchant. Khusus superadmin dan admin keuangan. Tiket terbit, lalu bot WA mengirim tautannya ke
// pemesan dan superadmin dikabari lewat Telegram (worker di VPS membaca kolom waNotifiedAt/adminNotifiedAt).
export async function markManualPaidAction(orderId: string, confirmTotal: number): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, FINANCE)) return { error: "Hanya superadmin dan admin keuangan yang bisa menandai lunas" };
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, total: true, paymentMethod: true } });
  if (!order) return { error: "Order tidak ditemukan" };
  if (order.status === "PAID") return { error: "Order ini sudah lunas" };
  if (order.status !== "PENDING" && order.status !== "EXPIRED") return { error: "Hanya order yang menunggu bayar atau kedaluwarsa yang bisa ditandai lunas" };
  if (confirmTotal !== order.total) return { error: "Nominal yang dikonfirmasi berbeda dengan total order" };
  await markOrderPaid(orderId, {
    gateway: MANUAL_GATEWAY, gatewayRef: null, method: "qris", amount: order.total,
    rawPayload: { verifiedBy: admin.username, verifiedAt: new Date().toISOString(), previousStatus: order.status },
  });
  await logAdmin(admin.username, "tandai_lunas_manual", `${orderId} Rp${order.total}`);
  revalidatePath(`/kuweraadmin/peserta/${orderId}`);
  return { ok: "Order ditandai lunas, tiket sudah terbit" };
}

// Input datetime-local diisi dalam WIB ("2026-09-29T10:00"); kosong = tanpa batas waktu.
function wibToIso(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(`${s}:00+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function savePricingAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa mengubah harga" };
  const num = (k: string) => Number(String(form.get(k) ?? "").replace(/\D/g, ""));
  const text = (k: string) => String(form.get(k) ?? "").trim().slice(0, 40);
  const jam = (k: string) => { const v = String(form.get(k) ?? "").trim(); return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : ""; };
  const dailyFrom = jam("promoDailyFrom"), dailyTo = jam("promoDailyTo");
  const pricing: Pricing = {
    open: form.get("open") === "on",
    openAt: wibToIso(form.get("openAt")) ?? null,
    promo: {
      enabled: form.get("promoEnabled") === "on",
      label: text("promoLabel"),
      price: num("promoPrice"),
      start: wibToIso(form.get("promoStart")) ?? null,
      end: wibToIso(form.get("promoEnd")) ?? null,
      quota: num("promoQuota") || null, // kosong atau 0 = tanpa batas kuota
      daily: dailyFrom && dailyTo ? { from: dailyFrom, to: dailyTo } : null,
    },
    regular: { label: text("regularLabel"), price: num("regularPrice") },
  };
  if ([form.get("openAt"), form.get("promoStart"), form.get("promoEnd")].some((v) => wibToIso(v) === undefined)) return { error: "Format waktu tidak valid" };
  if (!pricing.regular.label || !pricing.promo.label) return { error: "Nama harga tidak boleh kosong" };
  if (pricing.regular.price < 1000 || pricing.promo.price < 1000) return { error: "Harga minimal Rp1.000" };
  if ((dailyFrom || dailyTo) && !(dailyFrom && dailyTo && dailyFrom < dailyTo)) return { error: "Jam harian promo perlu diisi keduanya, dan jam selesai setelah jam mulai" };
  if (pricing.promo.start && pricing.promo.end && pricing.promo.end <= pricing.promo.start) return { error: "Waktu selesai promo harus setelah waktu mulai" };
  await prisma.setting.upsert({ where: { key: "pricing" }, create: { key: "pricing", value: pricing }, update: { value: pricing } });
  await logAdmin(admin.username, "ubah_harga", JSON.stringify(pricing).slice(0, 500));
  revalidatePath("/");
  revalidatePath("/daftar");
  revalidatePath("/kuweraadmin/harga");
  return { ok: "Pengaturan harga tersimpan" };
}

// --- Kode promo (superadmin) ---
// Jenis: flat = harga khusus per tiket, fixed = potongan Rp per order, percent = diskon %. Kuota dihitung per tiket.
export async function savePromoAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa mengatur kode promo" };
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const discountType = String(form.get("discountType") ?? "");
  const num = (k: string) => Number(String(form.get(k) ?? "").replace(/\D/g, ""));
  const discountValue = num("discountValue");
  const quota = num("quota");
  const from = wibToIso(form.get("validFrom"));
  const until = wibToIso(form.get("validUntil"));
  if (!/^[A-Z0-9]{3,30}$/.test(code)) return { error: "Kode promo 3 sampai 30 huruf atau angka, tanpa spasi" };
  if (!["flat", "fixed", "percent"].includes(discountType)) return { error: "Jenis promo tidak dikenal" };
  if (discountType === "percent" ? discountValue < 1 || discountValue > 100 : discountValue < 1000) {
    return { error: discountType === "percent" ? "Diskon persen antara 1 sampai 100" : "Nilai minimal Rp1.000" };
  }
  if (quota < 1) return { error: "Kuota minimal 1 orang" };
  if (from === undefined || !until) return { error: "Isi waktu berlaku sampai dengan benar" };
  const validFrom = from ? new Date(from) : new Date();
  const validUntil = new Date(until);
  if (validUntil <= validFrom) return { error: "Waktu berakhir harus setelah waktu mulai" };
  const data = { discountType, discountValue, quota, validFrom, validUntil, isActive: form.get("isActive") === "on" };
  await prisma.promoCode.upsert({ where: { code }, create: { code, ...data }, update: data });
  await logAdmin(admin.username, "ubah_promo", JSON.stringify({ code, ...data }).slice(0, 500));
  revalidatePath("/daftar");
  revalidatePath("/kuweraadmin/promo");
  return { ok: `Kode ${code} tersimpan` };
}

// Hapus kode promo. Kode yang pernah dipakai order tidak bisa dihapus (riwayat order tetap utuh); nonaktifkan saja.
export async function deletePromoAction(code: string): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa menghapus kode promo" };
  const used = await prisma.order.count({ where: { promoCode: code } });
  if (used > 0) return { error: `Kode ${code} sudah dipakai ${used} order, jadi tidak bisa dihapus. Hilangkan centang Kode aktif untuk mematikannya.` };
  const { count } = await prisma.promoCode.deleteMany({ where: { code } });
  if (!count) return { error: `Kode ${code} tidak ditemukan` };
  await logAdmin(admin.username, "hapus_promo", code);
  revalidatePath("/daftar");
  revalidatePath("/kuweraadmin/promo");
  return { ok: `Kode ${code} dihapus` };
}

// --- Reg ulang race pack (petugas) ---
export type RegTicket = {
  code: string; name: string; jersey: string; gender: string; nik: string; community: string | null;
  orderId: string; paid: boolean; collectedAt: string | null; collectedBy: string | null;
};

const ticketView = {
  code: true, racepackCollectedAt: true, collectedBy: true, orderId: true,
  order: { select: { status: true } },
  participant: { select: { fullName: true, jerseySize: true, gender: true, idNumber: true, community: true } },
} as const;

type TicketRow = { code: string; racepackCollectedAt: Date | null; collectedBy: string | null; orderId: string; order: { status: string };
  participant: { fullName: string; jerseySize: string; gender: string; idNumber: string | null; community: string | null } | null };

// NIK tersamar (4 angka awal dan akhir), cukup untuk dicocokkan dengan KTP/KIA yang dibawa peserta.
const toRegTicket = (t: TicketRow): RegTicket => ({
  code: t.code, name: t.participant?.fullName ?? "-", jersey: t.participant?.jerseySize ?? "-",
  gender: t.participant?.gender === "P" ? "Perempuan" : "Laki-laki",
  nik: t.participant?.idNumber ? `${t.participant.idNumber.slice(0, 4)}********${t.participant.idNumber.slice(-4)}` : "-",
  community: t.participant?.community ?? null, orderId: t.orderId, paid: t.order.status === "PAID",
  collectedAt: t.racepackCollectedAt?.toISOString() ?? null, collectedBy: t.collectedBy,
});

export async function lookupTicketAction(code: string): Promise<{ ticket?: RegTicket; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SCAN)) return { error: "Sesi habis, masuk lagi" };
  const clean = code.trim().toUpperCase();
  if (!/^KWR-\d{4}-[A-Z0-9]{6}-\d{1,2}$/.test(clean)) return { error: "QR ini bukan tiket KUWERA 5K" };
  const t = await prisma.ticket.findUnique({ where: { code: clean }, select: ticketView });
  return t ? { ticket: toRegTicket(t) } : { error: "Tiket tidak ditemukan" };
}

// Cadangan kalau QR tidak terbaca: cari nama, nomor HP, atau kode tiket/order (minimal 2 huruf, maksimal 10 hasil).
export async function searchTicketsAction(q: string): Promise<{ tickets?: RegTicket[]; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SCAN)) return { error: "Sesi habis, masuk lagi" };
  const s = q.trim();
  if (s.length < 2) return { tickets: [] };
  const rows = await prisma.ticket.findMany({
    where: {
      order: { status: "PAID" },
      OR: [
        { code: { contains: s, mode: "insensitive" } },
        { participant: { fullName: { contains: s, mode: "insensitive" } } },
        { participant: { phone: { contains: s.replace(/\D/g, "") || s } } },
      ],
    },
    select: ticketView, orderBy: { code: "asc" }, take: 10,
  });
  return { tickets: rows.map(toRegTicket) };
}


// --- Anggota Kudam (khusus superadmin) ---
// Diinput superadmin: cukup nama, nomor WA, ukuran jersey. Harga tetap Rp125.000, bayar QRIS statis tanpa kode unik
// (nominalnya disampaikan superadmin), tidak memakai kuota harga promo tapi tetap masuk kuota total peserta.
// Batas bayar = hari lomba, jadi tidak ikut kedaluwarsa otomatis maupun pengingat bot.
const KUDAM_PRICE = 125000;
const KUDAM_HOLD_UNTIL = new Date("2026-10-24T00:00:00+07:00");
export type KudamRow = { nama: string; wa: string; jersey: string };

export async function createKudamAction(rows: KudamRow[]): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa menambah anggota Kudam" };
  const clean: KudamRow[] = [];
  for (const [i, r] of rows.entries()) {
    const nama = titleName(r.nama ?? "");
    const wa = normalizePhone(r.wa);
    if (!r.nama?.trim() && !r.wa?.trim()) continue; // baris kosong dilewati
    if (!/^[\p{L}][\p{L}\s.,'()/-]*$/u.test(nama) || nama.length < 2) return { error: `Baris ${i + 1}: nama diisi huruf, minimal 2 huruf` };
    if (!/^08\d{8,11}$/.test(wa)) return { error: `Baris ${i + 1}: nomor WA diawali 08 dan berisi 10 sampai 13 angka` };
    if (!(JERSEY_SIZES as readonly string[]).includes(r.jersey)) return { error: `Baris ${i + 1}: ukuran jersey belum dipilih` };
    clean.push({ nama, wa, jersey: r.jersey });
  }
  if (!clean.length) return { error: "Belum ada anggota yang diisi" };
  const category = await prisma.category.findFirst({ where: { isActive: true }, orderBy: { price: "asc" } });
  if (!category) return { error: "Kategori pendaftaran tidak ditemukan" };
  const settings = await getSettings();
  const now = new Date();
  const r = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ORDER_LOCK_KEY})`;
    const left = Math.min(category.quota - (await heldCount(category.id, now, tx)), settings.quotaTotal - (await heldCount(null, now, tx)));
    if (left < clean.length) return { error: `Sisa kuota peserta tinggal ${Math.max(0, left)}` };
    for (const m of clean) {
      await tx.order.create({
        data: {
          id: newOrderId(), categoryId: category.id, status: "PENDING", subtotal: KUDAM_PRICE, discount: 0, fee: 0, total: KUDAM_PRICE,
          quantity: 1, uniqueCode: 0, paymentMethod: "qris", buyerEmail: "", buyerPhone: m.wa, expiresAt: KUDAM_HOLD_UNTIL, source: "kudam",
          participants: { create: [{
            position: 1, fullName: m.nama, firstName: m.nama, phone: m.wa, email: "", jerseySize: m.jersey,
            birthDate: new Date("2000-01-01T00:00:00+07:00"), gender: "L", emergencyName: "-", emergencyPhone: "-", community: "Kudam V/Brawijaya",
          }] },
        },
      });
    }
    return { ok: `${clean.length} anggota Kudam ditambahkan` };
  }, { timeout: 20_000 });
  if (r.ok) await logAdmin(admin.username, "tambah_kudam", `${clean.length} anggota: ${clean.map((m) => m.nama).join(", ").slice(0, 300)}`);
  revalidatePath("/kuweraadmin/kudam");
  return r;
}

// Tandai lunas beberapa anggota sekaligus. Superadmin mengetik ulang total yang masuk (jumlah x Rp125.000) sebagai
// konfirmasi; setelah lunas bot WA mengirim e-ticket dan QR registrasi ulang ke nomor WA tiap anggota.
export async function markKudamPaidAction(orderIds: string[], confirmTotal: number): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa menandai lunas" };
  const orders = await prisma.order.findMany({ where: { id: { in: orderIds }, source: "kudam", status: "PENDING" }, select: { id: true, total: true } });
  if (!orders.length || orders.length !== orderIds.length) return { error: "Ada anggota yang sudah lunas atau tidak ditemukan, muat ulang halaman" };
  const total = orders.reduce((n, o) => n + o.total, 0);
  if (confirmTotal !== total) return { error: `Total yang diketik berbeda dengan tagihan (Rp${total.toLocaleString("id-ID")})` };
  for (const o of orders) {
    await markOrderPaid(o.id, {
      gateway: MANUAL_GATEWAY, gatewayRef: null, method: "qris", amount: o.total,
      rawPayload: { verifiedBy: admin.username, via: "kudam", verifiedAt: new Date().toISOString(), note: "Anggota Kudam, bayar QRIS statis" },
    });
  }
  await logAdmin(admin.username, "lunas_kudam", `${orders.length} anggota Rp${total}`);
  revalidatePath("/kuweraadmin/kudam");
  return { ok: `${orders.length} anggota ditandai lunas. E-ticket dikirim bot ke WhatsApp masing-masing.` };
}

export async function cancelKudamAction(orderId: string): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa membatalkan" };
  const r = await prisma.order.updateMany({ where: { id: orderId, source: "kudam", status: "PENDING" }, data: { status: "EXPIRED", expiresAt: new Date() } });
  if (!r.count) return { error: "Anggota ini sudah lunas atau tidak ditemukan" };
  await logAdmin(admin.username, "batal_kudam", orderId);
  revalidatePath("/kuweraadmin/kudam");
  return { ok: "Dibatalkan" };
}

// Penarikan GoPay Merchant: disimpan sebagai daftar di Setting "gopay.penarikan" (lihat src/lib/penarikan.ts).
export async function tambahPenarikanAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa mencatat penarikan" };
  const num = (k: string) => Number(String(form.get(k) ?? "").replace(/\D/g, ""));
  const tanggal = String(form.get("tanggal") ?? "");
  const saldo = num("saldo"), masuk = num("masuk");
  const catatan = String(form.get("catatan") ?? "").trim().slice(0, 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: "Isi tanggal penarikan" };
  if (!saldo || !masuk) return { error: "Isi saldo yang ditarik dan jumlah yang masuk rekening" };
  if (masuk > saldo) return { error: "Jumlah masuk rekening tidak mungkin lebih besar dari saldo yang ditarik" };
  const list = [...(await getPenarikan()), { id: crypto.randomUUID(), tanggal, saldo, masuk, catatan, oleh: admin.username, dibuat: new Date().toISOString() }];
  await prisma.setting.upsert({ where: { key: PENARIKAN_KEY }, create: { key: PENARIKAN_KEY, value: list }, update: { value: list } });
  await logAdmin(admin.username, "catat_penarikan", `${tanggal} saldo ${saldo} masuk ${masuk}`);
  revalidatePath("/kuweraadmin");
  revalidatePath("/kuweraadmin/penarikan");
  return { ok: "Penarikan tercatat" };
}

export async function hapusPenarikanAction(id: string): Promise<FormState> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa menghapus penarikan" };
  const list = await getPenarikan();
  const hapus = list.find((p) => p.id === id);
  if (!hapus) return { error: "Catatan tidak ditemukan" };
  const sisa = list.filter((p) => p.id !== id);
  await prisma.setting.update({ where: { key: PENARIKAN_KEY }, data: { value: sisa } });
  await logAdmin(admin.username, "hapus_penarikan", `${hapus.tanggal} saldo ${hapus.saldo} masuk ${hapus.masuk}`);
  revalidatePath("/kuweraadmin");
  revalidatePath("/kuweraadmin/penarikan");
  return { ok: "Catatan dihapus" };
}
