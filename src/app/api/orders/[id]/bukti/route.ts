import { prisma } from "@/lib/db";
import { paymentMode } from "@/lib/orders";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { JENIS, MAKS_BYTE, stempelWib } from "@/lib/berkas-gambar";

export const runtime = "nodejs";

// Unggah bukti bayar QRIS dari halaman /bayar (pengganti kiriman screenshot lewat WhatsApp). Buktinya masuk tabel
// PaymentProof dengan source "web"; skrip kuwera-email-tiket di VPS meneruskannya ke Discord #chatbot dengan tombol
// Setujui dan Tolak, sama seperti bukti yang dulu diteruskan bot WhatsApp.
const MAKS_PER_ORDER = 5;

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
  await prisma.paymentProof.create({ data: { orderId: id, fileName: `${stempelWib()}-bukti.${jenis.ext}`, mimeType: file.type, data, source: "web" } });
  return Response.json({ ok: true });
}
