import { prisma } from "@/lib/db";
import { paymentMode } from "@/lib/orders";
import { rateLimit, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Unggah bukti bayar QRIS dari halaman /bayar (pengganti kiriman screenshot lewat WhatsApp). Buktinya masuk tabel
// PaymentProof dengan source "web"; skrip kuwera-email-tiket di VPS meneruskannya ke Discord #chatbot dengan tombol
// Setujui dan Tolak, sama seperti bukti yang dulu diteruskan bot WhatsApp.
const MAKS_BYTE = 4 * 1024 * 1024; // di bawah batas badan permintaan fungsi Vercel (4,5 MB)
const MAKS_PER_ORDER = 5;
const JENIS: Record<string, { ext: string; cocok: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", cocok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", cocok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", cocok: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
};

const gagal = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (paymentMode() !== "manual") return gagal("Tidak tersedia", 404);
  if (!(await rateLimit("bukti", 12, 600))) return tooMany();
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!order) return gagal("Order tidak ditemukan", 404);
  if (order.status === "PAID") return gagal("Order ini sudah lunas, tidak perlu mengunggah bukti lagi.", 409);
  if (order.status !== "PENDING" && order.status !== "EXPIRED") return gagal("Order ini tidak menunggu pembayaran.", 409);

  const form = await req.formData().catch(() => null);
  const file = form?.get("bukti");
  if (!(file instanceof File) || file.size === 0) return gagal("Pilih gambar bukti bayarnya dulu, ya.");
  const jenis = JENIS[file.type];
  if (!jenis) return gagal("Bukti bayar perlu berupa gambar JPG, PNG, atau WebP (screenshot dari aplikasi bank atau e-wallet).");
  if (file.size > MAKS_BYTE) return gagal("Ukuran gambarnya lebih dari 4 MB. Coba kirim screenshot, bukan foto layar.");
  const data = Buffer.from(await file.arrayBuffer());
  if (!jenis.cocok(data)) return gagal("File ini tidak terbaca sebagai gambar. Coba screenshot ulang bukti bayarnya.");

  const jumlah = await prisma.paymentProof.count({ where: { orderId: id, source: "web" } });
  if (jumlah >= MAKS_PER_ORDER) return gagal("Bukti bayar order ini sudah kami terima beberapa kali. Mohon tunggu pengecekan admin, ya.", 429);

  // Nama file memakai waktu WIB, sama dengan bukti dari WhatsApp (contoh 2026-10-04_091502-bukti.jpg).
  const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "");
  await prisma.paymentProof.create({ data: { orderId: id, fileName: `${stamp}-bukti.${jenis.ext}`, mimeType: file.type, data, source: "web" } });
  return Response.json({ ok: true });
}
