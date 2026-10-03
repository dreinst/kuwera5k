import QRCode from "qrcode";
import { dynamicQris, qrisStatic } from "@/lib/qris";
import { formatRupiah } from "@/lib/registration";

// Bahan halaman /bayar dan kartu bayar untuk mode manual (QRIS dinamis + unggah bukti bayar di halaman).

type OrderForManual = {
  id: string; total: number; subtotal: number; discount: number; uniqueCode: number; quantity: number; promoCode: string | null;
  participants: { position: number; fullName: string; jerseySize: string }[];
};

export const qrisPayloadFor = (total: number) => {
  const s = qrisStatic();
  return s ? dynamicQris(s, total) : null;
};

export async function qrisPngFor(total: number, width = 720) {
  const payload = qrisPayloadFor(total);
  return payload ? QRCode.toDataURL(payload, { margin: 2, width, errorCorrectionLevel: "M" }) : null;
}

// Pesan WhatsApp yang otomatis terisi saat pemesan menekan tombol di /bayar. Nomor order di dalamnya
// dikenali bot WA, yang lalu membalas dengan kartu bayar (QRIS bernominal).
export function confirmText(o: OrderForManual) {
  const people = [...o.participants].sort((a, b) => a.position - b.position);
  return [
    "Halo kak, saya mau membayar pendaftaran KUWERA 5K. Boleh minta QRIS-nya?",
    "",
    `No. order: ${o.id}`,
    `Nama pemesan: ${people[0]?.fullName ?? "-"}`,
    `Jumlah tiket: ${o.quantity}`,
    `Total: ${formatRupiah(o.total)}`,
    "",
    "Peserta:",
    ...people.map((p) => `${p.position}. ${p.fullName} (jersey ${p.jerseySize})`),
  ].join("\n");
}

export function priceLines(o: OrderForManual) {
  const unit = Math.round(o.subtotal / Math.max(1, o.quantity));
  const lines: [string, string][] = [
    ["Jumlah tiket", `${o.quantity} tiket`],
    ["Harga", o.quantity > 1 ? `${o.quantity} × ${formatRupiah(unit)}` : formatRupiah(unit)],
  ];
  if (o.discount > 0) lines.push([`Diskon ${o.promoCode ?? ""}`.trim(), `−${formatRupiah(o.discount)}`]);
  if (o.uniqueCode > 0) lines.push(["Kode unik", formatRupiah(o.uniqueCode)]);
  return lines;
}
