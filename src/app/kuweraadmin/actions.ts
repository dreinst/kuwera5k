"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { FINANCE, LOGIN_ERROR, SCAN, SUPER, allowed, attemptLogin, clientIp, deviceName, endSession, getAdmin, hashPassword, homeFor, logAdmin, sha256 } from "@/lib/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { checkOrderWithMidtrans, type MidtransCheck } from "@/lib/admin-data";
import { MANUAL_GATEWAY, markOrderPaid, syncOrderWithMidtrans } from "@/lib/orders";
import { verifyTurnstile } from "@/lib/turnstile";
import type { Pricing } from "@/lib/pricing";

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
  if (!admin || !allowed(admin.role, SCAN)) return { error: "Hanya superadmin dan petugas race pack yang bisa menandai" };
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
  const pricing: Pricing = {
    open: form.get("open") === "on",
    openAt: wibToIso(form.get("openAt")) ?? null,
    promo: {
      enabled: form.get("promoEnabled") === "on",
      label: text("promoLabel"),
      price: num("promoPrice"),
      start: wibToIso(form.get("promoStart")) ?? null,
      end: wibToIso(form.get("promoEnd")) ?? null,
    },
    regular: { label: text("regularLabel"), price: num("regularPrice") },
  };
  if ([form.get("openAt"), form.get("promoStart"), form.get("promoEnd")].some((v) => wibToIso(v) === undefined)) return { error: "Format waktu tidak valid" };
  if (!pricing.regular.label || !pricing.promo.label) return { error: "Nama harga tidak boleh kosong" };
  if (pricing.regular.price < 1000 || pricing.promo.price < 1000) return { error: "Harga minimal Rp1.000" };
  if (pricing.promo.start && pricing.promo.end && pricing.promo.end <= pricing.promo.start) return { error: "Waktu selesai promo harus setelah waktu mulai" };
  await prisma.setting.upsert({ where: { key: "pricing" }, create: { key: "pricing", value: pricing }, update: { value: pricing } });
  await logAdmin(admin.username, "ubah_harga", JSON.stringify(pricing).slice(0, 500));
  revalidatePath("/");
  revalidatePath("/daftar");
  revalidatePath("/kuweraadmin/harga");
  return { ok: "Pengaturan harga tersimpan" };
}

// --- Reg ulang race pack (superadmin dan petugas) ---
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

// Tandai order sebagai data uji (tidak dihapus, tapi tidak dihitung di statistik, kuota, dan pendapatan) atau sebaliknya.
export async function setTestOrderAction(orderId: string, isTest: boolean): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin || !allowed(admin.role, SUPER)) return { error: "Hanya superadmin yang bisa mengubah tanda data uji" };
  const r = await prisma.order.updateMany({ where: { id: orderId }, data: { isTest } });
  if (!r.count) return { error: "Order tidak ditemukan" };
  await logAdmin(admin.username, isTest ? "tandai_data_uji" : "batal_data_uji", orderId);
  revalidatePath(`/kuweraadmin/peserta/${orderId}`);
  return { ok: isTest ? "Ditandai sebagai data uji, tidak lagi dihitung" : "Tanda data uji dilepas, order kembali dihitung" };
}
