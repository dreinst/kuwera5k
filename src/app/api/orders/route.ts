import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orderInputSchema, issuesToMap } from "@/lib/registration";
import {
  ORDER_LOCK_KEY, activeOrderWhere, getSettings, heldCount, newOrderId, paymentMode, syncOrderWithMidtrans, validatePromo,
} from "@/lib/orders";

type Refusal = { error: string; status: number; fields?: Record<string, string> };

// Antrean kunci habis (lock_timeout, SQLSTATE 55P03) atau transaksi Prisma kedaluwarsa (P2028).
function isBusy(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2028", "P2034"].includes(e.code)) return true;
  const text = e instanceof Error ? `${e.message} ${JSON.stringify((e as { meta?: unknown }).meta ?? "")}` : "";
  return /55P03|lock timeout|lock_not_available|canceling statement due to lock timeout/i.test(text);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Periksa kembali isian kamu", fields: issuesToMap(parsed.error.issues) }, { status: 400 });
  }
  const input = parsed.data;
  const now = new Date();

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, isActive: true, saleStart: { lte: now }, saleEnd: { gte: now } },
  });
  if (!category) return NextResponse.json({ error: "Kategori tidak tersedia atau pendaftaran sudah ditutup" }, { status: 400 });

  const settings = await getSettings();
  if (!settings.methods.includes(input.paymentMethod)) {
    const message = "Metode pembayaran ini sedang tidak tersedia, pilih metode lain";
    return NextResponse.json({ error: message, fields: { paymentMethod: message } }, { status: 400 });
  }

  const p = input.participant;
  const sameContact = { OR: [{ buyerEmail: p.email }, { buyerPhone: p.phone }] };

  // Order lama dengan email/HP yang sama yang pernah membuka Snap dan belum lunas (hold sudah habis,
  // atau gagal): pastikan dulu ke Midtrans. Bisa jadi sudah dibayar dan notifikasinya telat, jadi
  // jangan sampai peserta bayar dua kali. Pesan sengaja tidak menyebut nomor order, karena nomor
  // order juga kode tiket dan siapa pun bisa mengisi email atau HP orang lain.
  if (paymentMode() === "midtrans") {
    const stale = await prisma.order.findMany({
      where: {
        categoryId: category.id, snapToken: { not: null }, ...sameContact,
        AND: [{ OR: [{ status: "PENDING", expiresAt: { lte: now } }, { status: "FAILED" }] }],
      },
      select: { id: true, total: true, status: true, paymentMethod: true, expiresAt: true },
      take: 5,
    });
    for (const o of stale) {
      const r = await syncOrderWithMidtrans(o, now);
      if (r.live === "pending" || r.live === "error" || r.mismatch) {
        return NextResponse.json(
          { error: "Pembayaran sebelumnya dengan email atau nomor HP ini masih diproses Midtrans. Buka lagi halaman pembayarannya di perangkat yang kamu pakai, atau coba beberapa menit lagi." },
          { status: 409 },
        );
      }
    }
  }

  const fee = settings.fees[input.paymentMethod] ?? 0;
  const subtotal = category.price;
  const expiresAt = new Date(now.getTime() + settings.holdMinutes * 60_000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newOrderId(now.getFullYear());
    try {
      const result = await prisma.$transaction(async (tx): Promise<Refusal | { orderId: string; total: number; expiresAt: Date | null }> => {
        // Semua pengecekan di bawah berjalan di dalam kunci supaya pendaftaran bersamaan tidak lolos bareng.
        // lock_timeout membatalkan antrean kunci di Postgres (timer Prisma tidak bisa), dan sesi yang
        // macet di tengah transaksi diputus Postgres supaya kuncinya tidak tertahan.
        await tx.$executeRaw`SET LOCAL lock_timeout = '8s'`;
        await tx.$executeRaw`SET LOCAL idle_in_transaction_session_timeout = '15s'`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ORDER_LOCK_KEY})`;

        const duplicate = await tx.order.findFirst({
          where: { categoryId: category.id, AND: [activeOrderWhere(now), sameContact] },
          select: { id: true, status: true },
        });
        if (duplicate) {
          return {
            error: duplicate.status === "PAID"
              ? "Email atau nomor HP ini sudah terdaftar"
              : "Email atau nomor HP ini sedang dalam proses pembayaran. Selesaikan dulu atau tunggu sampai waktunya habis.",
            status: 409,
          };
        }

        const held = await heldCount(category.id, now, tx);
        const totalHeld = await heldCount(null, now, tx);
        if (held >= category.quota || totalHeld >= settings.quotaTotal) return { error: "Kuota sudah penuh", status: 409 };

        let discount = 0;
        let promoCode: string | null = null;
        if (input.promoCode) {
          const res = await validatePromo(input.promoCode, category.price, now, tx);
          if (!res.ok) return { error: res.message, fields: { promoCode: res.message }, status: 400 };
          discount = res.discount;
          promoCode = res.promo.code;
        }
        const total = Math.max(0, subtotal - discount) + fee;

        const created = await tx.order.create({
          data: {
            id, categoryId: category.id, status: "PENDING", subtotal, discount, fee, total, promoCode,
            paymentMethod: input.paymentMethod, buyerEmail: p.email, buyerPhone: p.phone, expiresAt,
            participant: {
              create: {
                fullName: p.fullName, birthDate: new Date(`${p.birthDate}T00:00:00+07:00`), gender: p.gender,
                phone: p.phone, email: p.email, jerseySize: p.jerseySize,
                emergencyName: p.emergencyName, emergencyPhone: p.emergencyPhone, community: p.community || null,
              },
            },
          },
        });
        return { orderId: created.id, total: created.total, expiresAt: created.expiresAt };
      }, { maxWait: 10_000, timeout: 20_000 });

      if ("error" in result) {
        return NextResponse.json({ error: result.error, ...(result.fields ? { fields: result.fields } : {}) }, { status: result.status });
      }
      return NextResponse.json({
        orderId: result.orderId, total: result.total, expiresAt: result.expiresAt, paymentMode: paymentMode(), next: `/bayar/${result.orderId}`,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      if (isBusy(e)) {
        return NextResponse.json({ error: "Pendaftaran sedang ramai, coba lagi beberapa detik lagi" }, { status: 503 });
      }
      throw e;
    }
  }
  return NextResponse.json({ error: "Gagal membuat nomor order, coba lagi" }, { status: 500 });
}
