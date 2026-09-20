import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orderInputSchema, issuesToMap } from "@/lib/registration";
import { activeOrderWhere, getSettings, heldCount, newOrderId, paymentMode, validatePromo } from "@/lib/orders";

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
  const [held, totalHeld] = await Promise.all([heldCount(category.id, now), heldCount(null, now)]);
  if (held >= category.quota || totalHeld >= settings.quotaTotal) {
    return NextResponse.json({ error: "Kuota sudah penuh" }, { status: 409 });
  }

  const p = input.participant;
  const duplicate = await prisma.order.findFirst({
    where: { categoryId: category.id, ...activeOrderWhere(now), OR: [{ buyerEmail: p.email }, { buyerPhone: p.phone }] },
    select: { id: true, status: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: duplicate.status === "PAID" ? "Email atau nomor HP ini sudah terdaftar" : "Email atau nomor HP ini sedang dalam proses pembayaran, cek email kamu atau tunggu 30 menit" },
      { status: 409 },
    );
  }

  let discount = 0;
  let promoCode: string | null = null;
  if (input.promoCode) {
    const res = await validatePromo(input.promoCode, category.price, now);
    if (!res.ok) return NextResponse.json({ error: res.message, fields: { promoCode: res.message } }, { status: 400 });
    discount = res.discount;
    promoCode = res.promo.code;
  }
  const fee = settings.fees[input.paymentMethod] ?? 0;
  const subtotal = category.price;
  const total = Math.max(0, subtotal - discount) + fee;
  const expiresAt = new Date(now.getTime() + settings.holdMinutes * 60_000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newOrderId(now.getFullYear());
    try {
      const order = await prisma.$transaction(async (tx) => {
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
        if (promoCode) await tx.promoCode.update({ where: { code: promoCode }, data: { usedCount: { increment: 1 } } });
        return created;
      });
      return NextResponse.json({
        orderId: order.id, total: order.total, expiresAt: order.expiresAt, paymentMode: paymentMode(), next: `/bayar/${order.id}`,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return NextResponse.json({ error: "Gagal membuat nomor order, coba lagi" }, { status: 500 });
}
