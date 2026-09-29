import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { paymentMode } from "@/lib/orders";
import { priceLines, qrisPngFor } from "@/lib/manual-payment";
import { formatRupiah } from "@/lib/registration";
import { rateLimit, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Kartu bayar (PNG): logo, nomor order, QRIS dinamis bernominal total, rincian harga. Dipakai tombol
// "Simpan QRIS" di /bayar dan dikirim bot WhatsApp sebagai satu gambar untuk seluruh pembelian.
// Tidak memuat data pribadi, jadi aman dibuka siapa pun yang memegang nomor order (sama seperti /bayar).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (paymentMode() !== "manual") return new Response("Tidak tersedia", { status: 404 });
  if (!(await rateLimit("qris", 120, 600))) return tooMany();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true, status: true, total: true, subtotal: true, discount: true, uniqueCode: true, quantity: true, promoCode: true, expiresAt: true,
      participants: { select: { position: true, fullName: true, jerseySize: true } },
    },
  });
  if (!order || order.status !== "PENDING") return new Response("Order tidak ditemukan atau sudah tidak menunggu pembayaran", { status: 404 });
  const qr = await qrisPngFor(order.total);
  if (!qr) return new Response("QRIS belum diatur", { status: 503 });

  const root = process.cwd();
  const [anton, geist, logo] = await Promise.all([
    readFile(path.join(root, "src/assets/fonts/Anton-Regular.ttf")),
    readFile(path.join(root, "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")),
    readFile(path.join(root, "public/brand/kuwera-logo-funrun.png")),
  ]);
  const deadline = order.expiresAt?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const W = 900;

  return new ImageResponse(
    (
      <div style={{ width: W, height: 1720, display: "flex", flexDirection: "column", alignItems: "center", background: "linear-gradient(160deg, #13663d 0%, #0b4a2c 100%)", color: "#FDFBF5", padding: "56px 60px", fontFamily: "Geist" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- gambar di dalam ImageResponse */}
        <img src={`data:image/png;base64,${logo.toString("base64")}`} width={460} height={160} />
        <div style={{ fontFamily: "Anton", fontSize: 54, marginTop: 28, letterSpacing: 1 }}>PEMBAYARAN KUWERA 5K</div>
        <div style={{ fontSize: 32, color: "#F4E71D", marginTop: 6 }}>{`No. order ${order.id}`}</div>
        <div style={{ display: "flex", marginTop: 28, background: "#FFFFFF", borderRadius: 28, padding: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- gambar di dalam ImageResponse */}
          <img src={qr} width={700} height={700} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 30 }}>
          {priceLines(order).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 32, marginTop: 8 }}>
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", height: 3, background: "#64A322", marginTop: 20 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, color: "#FFBB00" }}>
            <span style={{ fontFamily: "Anton", fontSize: 44 }}>TOTAL BAYAR</span>
            <span style={{ fontFamily: "Anton", fontSize: 60 }}>{formatRupiah(order.total)}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 28, fontSize: 27, lineHeight: 1.45, textAlign: "center" }}>
          <span>Silakan scan QRIS di atas, nominalnya sudah terisi otomatis.</span>
          <span>Mohon bayar sesuai total, lalu kirimkan bukti bayarnya ke WhatsApp panitia ya.</span>
          {deadline && <span style={{ color: "#F4E71D" }}>{`Kami tunggu pembayarannya sebelum ${deadline} WIB`}</span>}
        </div>
      </div>
    ),
    { width: W, height: 1720, fonts: [{ name: "Geist", data: geist, weight: 400, style: "normal" }, { name: "Anton", data: anton, weight: 400, style: "normal" }], headers: { "Cache-Control": "private, no-store" } },
  );
}
