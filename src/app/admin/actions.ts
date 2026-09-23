"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { attemptLogin, clientIp, endSession, getAdmin, hashPassword, logAdmin, sha256 } from "@/lib/admin-auth";
import { checkOrderWithMidtrans, type MidtransCheck } from "@/lib/admin-data";
import { syncOrderWithMidtrans } from "@/lib/orders";
import { verifyTurnstile } from "@/lib/turnstile";

// Server action = endpoint publik: setiap aksi memeriksa sesi dan perannya sendiri.

export type FormState = { error?: string; ok?: string } | null;

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), await clientIp()))) {
    return { error: "Verifikasi bukan robot gagal. Centang ulang kotaknya." };
  }
  if (!username || !password) return { error: "Isi username dan kata sandi" };
  const res = await attemptLogin(username, password);
  if (!res.ok) return { error: res.message };
  redirect("/admin");
}

export async function logoutAction() {
  const admin = await getAdmin();
  if (admin) await logAdmin(admin.username, "logout");
  await endSession();
  redirect("/admin/login");
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

// Cek satu order ke Midtrans (admin dan panitia).
export async function checkMidtransAction(orderId: string): Promise<MidtransCheck | { error: string }> {
  const admin = await getAdmin();
  if (!admin) return { error: "Sesi habis, masuk lagi" };
  const order = await orderForCheck(orderId);
  if (!order) return { error: "Order tidak ditemukan" };
  await logAdmin(admin.username, "cek_midtrans", orderId);
  return checkOrderWithMidtrans(order);
}

// Terapkan status resmi Midtrans ke order yang belum final (jalur yang sama dengan webhook).
export async function syncMidtransAction(orderId: string): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin) return { error: "Sesi habis, masuk lagi" };
  const order = await orderForCheck(orderId);
  if (!order) return { error: "Order tidak ditemukan" };
  if (order.status !== "PENDING" && order.status !== "FAILED") return { error: "Hanya order yang menunggu bayar atau gagal yang bisa disinkronkan" };
  const r = await syncOrderWithMidtrans(order);
  await logAdmin(admin.username, "sinkron_midtrans", `${orderId} ${order.status}->${r.status}`);
  revalidatePath(`/admin/peserta/${orderId}`);
  if (r.live === "error") return { error: `Midtrans tidak bisa dihubungi: ${r.detail ?? ""}` };
  if (r.mismatch) return { error: "Nominal di Midtrans berbeda dengan total order, status tidak diubah" };
  return { ok: `Status sekarang: ${r.status}` };
}

export async function racepackAction(orderId: string, undo = false): Promise<{ ok?: string; error?: string }> {
  const admin = await getAdmin();
  if (!admin) return { error: "Sesi habis, masuk lagi" };
  if (undo && admin.role !== "admin") return { error: "Hanya admin yang bisa membatalkan" };
  const ticket = await prisma.ticket.findUnique({ where: { orderId }, include: { order: { select: { status: true } } } });
  if (!ticket || ticket.order.status !== "PAID") return { error: "Order ini belum lunas atau belum punya tiket" };
  if (!undo && ticket.racepackCollectedAt) return { error: "Race pack sudah diambil sebelumnya" };
  await prisma.ticket.update({
    where: { orderId },
    data: undo ? { racepackCollectedAt: null, collectedBy: null } : { racepackCollectedAt: new Date(), collectedBy: admin.username },
  });
  await logAdmin(admin.username, undo ? "racepack_batal" : "racepack_ambil", orderId);
  revalidatePath(`/admin/peserta/${orderId}`);
  return { ok: undo ? "Tanda ambil race pack dibatalkan" : "Race pack ditandai sudah diambil" };
}

// Verifikasi massal: semua order yang pernah membuka Midtrans atau tercatat lunas, dicocokkan satu per satu.
export async function verifyAllAction(): Promise<{ results?: MidtransCheck[]; error?: string }> {
  const admin = await getAdmin();
  if (!admin || admin.role !== "admin") return { error: "Hanya admin yang bisa menjalankan verifikasi massal" };
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
