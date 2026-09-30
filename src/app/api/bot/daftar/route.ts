import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { botAuthorized } from "@/lib/bot-auth";
import { createOrder } from "@/lib/create-order";
import { LABEL, parseForm } from "@/lib/formulir-wa";
import { orderInputSchema } from "@/lib/registration";

// Pendaftaran dari formulir WhatsApp: isian dibaca, divalidasi dengan skema yang sama seperti website, lalu dibuat
// order lewat createOrder (harga, kuota, NIK ganda, kode unik). Satu formulir = satu peserta, bayar QRIS.
export async function POST(req: Request) {
  if (!botAuthorized(req)) return new Response("Tidak ditemukan", { status: 404 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text) return NextResponse.json({ masalah: ["Formulir kosong"] }, { status: 400 });

  const { form, problems } = parseForm(text);
  const now = new Date();
  const category = await prisma.category.findFirst({
    where: { isActive: true, saleStart: { lte: now }, saleEnd: { gte: now } }, orderBy: { price: "asc" }, select: { id: true },
  });
  if (!category) return NextResponse.json({ masalah: ["Pendaftaran sedang ditutup"] }, { status: 400 });

  const parsed = orderInputSchema.safeParse({
    categoryId: category.id, participants: [{ ...form, lastName: form.lastName ?? "", community: form.community ?? "" }],
    promoCode: "", paymentMethod: "qris", agreeTerms: true,
  });
  if (!parsed.success || problems.length) {
    const masalah = [...problems];
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const key = String(issue.path[issue.path.length - 1] ?? "");
      const label = LABEL[key];
      const pesan = issue.code === "invalid_type" ? "belum diisi" : issue.message;
      const line = label ? `${label}: ${pesan}` : pesan;
      if (!masalah.some((m) => m.startsWith(`${label}:`))) masalah.push(line);
    }
    return NextResponse.json({ masalah }, { status: 400 });
  }

  const r = await createOrder(parsed.data, now);
  return NextResponse.json(r.status === 200 ? r.body : { masalah: [String(r.body.error ?? "Pendaftaran gagal")] }, { status: r.status });
}
