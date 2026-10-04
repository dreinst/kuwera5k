import QRCode from "qrcode";

// Berkas yang bisa diunduh di admin: QR registrasi ulang (dibuat dari kode tiket) dan bukti bayar (tabel PaymentProof).
export const qrPng = (code: string) =>
  QRCode.toBuffer(code, { width: 600, margin: 2, color: { dark: "#0B4A2C", light: "#FFFFFF" } });

export const slug = (s: string) => s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "peserta";

export const qrFileName = (code: string, name: string) => `QR-${code}-${slug(name)}.png`;

export const download = (body: Uint8Array, type: string, fileName: string, inline = false) =>
  new Response(body as BodyInit, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
