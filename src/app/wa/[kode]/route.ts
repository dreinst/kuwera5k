import { NextResponse } from "next/server";
import { waLink } from "@/lib/whatsapp";

// Tautan iklan ke WhatsApp panitia dengan penanda di pesan terisi (/wa/IGB1), supaya chat bisa dilacak asal iklannya.
export async function GET(_req: Request, { params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const tanda = /^[\w.-]{1,40}$/.test(kode) ? ` (${kode})` : "";
  return NextResponse.redirect(waLink(`Halo kak, saya lihat iklan KUWERA Fun Run 5K dan mau tanya cara daftarnya.${tanda}`), 302);
}
