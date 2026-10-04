import { NextResponse } from "next/server";
import { botAuthorized } from "@/lib/bot-auth";
import { formTemplate } from "@/lib/formulir-wa";
import { siteUrl } from "@/lib/site";

// Template formulir pendaftaran lewat WhatsApp (dikirim bot saat pelanggan tidak bisa membuka website).
export async function GET(req: Request) {
  if (!botAuthorized(req)) return new Response("Tidak ditemukan", { status: 404 });
  return NextResponse.json({ template: formTemplate(siteUrl) });
}
