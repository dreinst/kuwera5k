import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { biayaLayananQris, fullNameOf, type OrderInput } from "@/lib/registration";
import { currentPrice, getPricing, isOpen, promoUsed } from "@/lib/pricing";
import {
  ORDER_LOCK_KEY, activeOrderWhere, getSettings, heldCount, newOrderId, paymentMode, pickUniqueCode, syncOrderWithMidtrans, validatePromo,
} from "@/lib/orders";

// Pembuatan order yang dipakai bersama formulir website (/api/orders) dan formulir WhatsApp lewat bot (/api/bot/daftar):
// kategori, buka/tutup, harga dan kuota promo, kuota peserta, NIK ganda, kode promo, dan kode unik dicek di sini.
type Refusal = { error: string; status: number; fields?: Record<string, string> };
export type CreateOrderResult = { status: number; body: Record<string, unknown> };

// Antrean kunci habis (lock_timeout, SQLSTATE 55P03) atau transaksi Prisma kedaluwarsa (P2028).
function isBusy(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2028", "P2034"].includes(e.code)) return true;
  const text = e instanceof Error ? `${e.message} ${JSON.stringify((e as { meta?: unknown }).meta ?? "")}` : "";
  return /55P03|lock timeout|lock_not_available|canceling statement due to lock timeout/i.test(text);
}

export async function createOrder(input: OrderInput, now = new Date()): Promise<CreateOrderResult> {
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, isActive: true, saleStart: { lte: now }, saleEnd: { gte: now } },
  });
  if (!category) return { status: 400, body: { error: "Kategori tidak tersedia atau pendaftaran sudah ditutup" } };
  const pricing = await getPricing();
  if (!isOpen(pricing, now)) return { status: 400, body: { error: "Pendaftaran sedang ditutup sementara" } };
  const unitPrice = currentPrice(pricing, now).price;

  const settings = await getSettings();
  const mode = paymentMode();
  const manual = mode === "manual";
  // Bayar manual hanya lewat QRIS; pilihan metode dari klien diabaikan.
  const paymentMethod = manual ? "qris" : input.paymentMethod;
  const people = input.participants;
  const quantity = people.length;
  if (quantity > settings.maxTickets) {
    return { status: 400, body: { error: `Maksimal ${settings.maxTickets} tiket per pembelian` } };
  }
  if (!manual && !settings.methods.includes(input.paymentMethod)) {
    const message = "Metode pembayaran ini sedang tidak tersedia, pilih metode lain";
    return { status: 400, body: { error: message, fields: { paymentMethod: message } } };
  }

  const p = people[0]; // peserta 1 = pemesan
  const niks = people.map((x) => x.idNumber);
  // Satu NIK satu tiket. Email dan HP boleh sama antar peserta (misalnya orang tua mendaftarkan anak).
  const sameNik = { participants: { some: { idNumber: { in: niks } } } };
  // Order lama milik pemesan yang sama (email/HP/NIK), dipakai untuk cek ulang ke Midtrans di bawah.
  const sameContact = { OR: [{ buyerEmail: p.email }, { buyerPhone: p.phone }, sameNik] };

  // Order lama dengan email/HP yang sama yang pernah membuka Snap dan belum lunas (hold sudah habis,
  // atau gagal): pastikan dulu ke Midtrans. Bisa jadi sudah dibayar dan notifikasinya telat, jadi
  // jangan sampai peserta bayar dua kali. Pesan sengaja tidak menyebut nomor order, karena nomor
  // order juga kode tiket dan siapa pun bisa mengisi email atau HP orang lain.
  if (mode === "midtrans") {
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
        return {
          status: 409,
          body: { error: "Pembayaran sebelumnya dengan email, nomor HP, atau nomor identitas ini masih diproses Midtrans. Buka lagi halaman pembayarannya di perangkat yang kamu pakai, atau coba beberapa menit lagi." },
        };
      }
    }
  }

  const fee = manual ? 0 : settings.fees[paymentMethod] ?? 0;
  const subtotal = unitPrice * quantity;
  const expiresAt = new Date(now.getTime() + (manual ? settings.manualHoldMinutes : settings.holdMinutes) * 60_000);

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
          where: { categoryId: category.id, AND: [activeOrderWhere(now), sameNik] },
          select: { id: true, status: true, participants: { select: { idNumber: true } } },
        });
        if (duplicate) {
          const nik = duplicate.participants.find((x) => x.idNumber && niks.includes(x.idNumber))?.idNumber;
          const i = niks.indexOf(nik ?? "");
          const who = quantity > 1 && i >= 0 ? `NIK peserta ${i + 1}` : "Nomor identitas (NIK) ini";
          const message = duplicate.status === "PAID"
            ? `${who} sudah terdaftar`
            : `${who} sedang dalam proses pembayaran. Selesaikan dulu atau tunggu sampai waktunya habis.`;
          return { error: message, status: 409, ...(i >= 0 ? { fields: { [`participants.${i}.idNumber`]: message } } : {}) };
        }

        const held = await heldCount(category.id, now, tx);
        const totalHeld = await heldCount(null, now, tx);
        const left = Math.min(category.quota - held, settings.quotaTotal - totalHeld);
        if (left <= 0) return { error: "Kuota sudah penuh", status: 409 };
        if (left < quantity) return { error: `Sisa kuota tinggal ${left} tiket`, status: 409 };

        // Kuota harga promo dicek ulang di dalam kunci supaya pendaftaran bersamaan tidak melewati kuota.
        if (pricing.promo.quota && unitPrice === pricing.promo.price && unitPrice !== pricing.regular.price) {
          const sisa = pricing.promo.quota - (await promoUsed(pricing.promo.price, now, tx));
          if (sisa < quantity) {
            const message = sisa > 0
              ? `Kuota ${pricing.promo.label} tinggal ${sisa} tiket, boleh kurangi jumlah tiketnya ya`
              : `Kuota ${pricing.promo.label} baru saja habis. Silakan muat ulang halaman, harga yang berlaku sekarang ${pricing.regular.label} Rp${pricing.regular.price.toLocaleString("id-ID")}`;
            return { error: message, status: 409 };
          }
        }

        let discount = 0;
        let promoCode: string | null = null;
        if (input.promoCode) {
          const res = await validatePromo(input.promoCode, subtotal, now, tx, quantity);
          if (!res.ok) return { error: res.message, fields: { promoCode: res.message }, status: 400 };
          discount = res.discount;
          promoCode = res.promo.code;
        }
        const hargaBersih = Math.max(0, subtotal - discount);
        // Bayar manual (QRIS GoPay): biaya layanan hanya untuk order yang kena potongan MDR, lihat biayaLayananQris.
        const biaya = manual ? biayaLayananQris(hargaBersih) : fee;
        const base = hargaBersih + biaya;
        let uniqueCode = 0;
        if (manual) {
          const code = await pickUniqueCode(base, now, tx);
          if (code === null) return { error: "Pendaftaran sedang ramai, coba lagi beberapa menit lagi", status: 503 };
          uniqueCode = code;
        }
        const total = base + uniqueCode;

        const created = await tx.order.create({
          data: {
            id, categoryId: category.id, status: "PENDING", subtotal, discount, fee: biaya, total, promoCode, quantity, uniqueCode,
            paymentMethod, buyerEmail: p.email, buyerPhone: p.phone, expiresAt, adRef: input.ref ?? null,
            participants: {
              create: people.map((x, i) => ({
                position: i + 1,
                fullName: fullNameOf(x), firstName: x.firstName, lastName: x.lastName || null, idNumber: x.idNumber,
                address: x.address, province: x.province, city: x.city, postalCode: x.postalCode, bloodType: x.bloodType,
                birthDate: new Date(`${x.birthDate}T00:00:00+07:00`), gender: x.gender,
                phone: x.phone, email: x.email, jerseySize: x.jerseySize,
                emergencyName: x.emergencyName, emergencyPhone: x.emergencyPhone, community: x.community || null,
              })),
            },
          },
        });
        return { orderId: created.id, total: created.total, expiresAt: created.expiresAt };
      }, { maxWait: 10_000, timeout: 20_000 });

      if ("error" in result) {
        return { status: result.status, body: { error: result.error, ...(result.fields ? { fields: result.fields } : {}) } };
      }
      return { status: 200, body: { orderId: result.orderId, total: result.total, expiresAt: result.expiresAt, paymentMode: mode, next: `/bayar/${result.orderId}` } };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      if (isBusy(e)) {
        return { status: 503, body: { error: "Pendaftaran sedang ramai, coba lagi beberapa detik lagi" } };
      }
      throw e;
    }
  }
  return { status: 500, body: { error: "Gagal membuat nomor order, coba lagi" } };
}
