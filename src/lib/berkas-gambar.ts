// Jenis gambar yang diterima untuk unggahan bukti (bukti bayar peserta, bukti transfer refund), dicek dari isi berkasnya.
export const MAKS_BYTE = 4 * 1024 * 1024;
export const JENIS: Record<string, { ext: string; cocok: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", cocok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", cocok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", cocok: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
};

// Nama file memakai waktu WIB (contoh 2026-10-04_091502).
export const stempelWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "");
