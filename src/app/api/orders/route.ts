import { NextResponse } from "next/server";
import { orderInputSchema, issuesToMap } from "@/lib/registration";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { createOrder } from "@/lib/create-order";

export async function POST(req: Request) {
  if (!(await rateLimit("order", 20, 600))) return tooMany();
  const body = await req.json().catch(() => null);
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ada isian yang perlu dicek lagi, ya", fields: issuesToMap(parsed.error.issues) }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  if (!(await verifyTurnstile(body?.turnstileToken, ip))) {
    return NextResponse.json({ error: "Verifikasi bukan robot belum berhasil. Boleh centang ulang kotaknya lalu coba lagi?" }, { status: 400 });
  }

  const r = await createOrder(parsed.data);
  return NextResponse.json(r.body, { status: r.status });
}
