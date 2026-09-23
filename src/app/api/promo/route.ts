import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validatePromo } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ code: z.string().trim().toUpperCase().min(1).max(30), categoryId: z.string().min(1) });

export async function POST(req: Request) {
  if (!(await rateLimit("promo", 20, 600))) return NextResponse.json({ valid: false, message: "Terlalu banyak percobaan, tunggu beberapa menit" }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ valid: false, message: "Masukkan kode promo" }, { status: 400 });
  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) return NextResponse.json({ valid: false, message: "Kategori tidak ditemukan" }, { status: 400 });
  const res = await validatePromo(parsed.data.code, category.price);
  if (!res.ok) return NextResponse.json({ valid: false, message: res.message });
  return NextResponse.json({ valid: true, code: res.promo.code, discount: res.discount, label: res.label });
}
