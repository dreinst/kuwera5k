// Pencocokan laporan transaksi GoPay Merchant (unduhan GoBiz, CSV atau ZIP) dengan pembayaran QRIS manual di database.
// Dicocokkan lewat nominal: tiap order punya kode unik, jadi nominalnya hampir selalu berbeda.
import { unzipSync, strFromU8 } from "fflate";

export type TxGopay = { waktu: string; t: number; nominal: number; mdr: number; ref: string };
export type BayarDb = { orderId: string; nama: string; nominal: number; diterima: number; dibuat: number; uji: boolean };
export type OrderLain = { id: string; status: string; total: number };
export type HasilCocok = {
  periode: string; jumlah: number; bruto: number; mdr: number; dilewati: number; cocok: number; luarPeriode: number;
  tanpaOrder: { waktu: string; t: number; nominal: number; ref: string; kandidat: string[] }[];
  disetujui: { orderId: string; nominal: number }[];
  tanpaUang: { orderId: string; nama: string; nominal: number; uji: boolean }[];
};

const BULAN: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, agu: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11 };

// "04 Oct 2026 - 09:43:09" (WIB) ke epoch ms.
function waktuWib(s: string): number {
  const m = /^(\d{1,2}) (\w{3})\w* (\d{4}) - (\d{2}):(\d{2}):(\d{2})$/.exec(s.trim());
  const bulan = m ? BULAN[m[2].toLowerCase()] : undefined;
  if (!m || bulan === undefined) return NaN;
  return Date.UTC(+m[3], bulan, +m[1], +m[4] - 7, +m[5], +m[6]);
}

// Berkas ZIP dari GoBiz berisi dua CSV; yang dipakai "Laporan Transaksi GoPay".
export function bacaBerkas(nama: string, isi: Uint8Array): string {
  if (!/\.zip$/i.test(nama)) return strFromU8(isi);
  const csv = Object.entries(unzipSync(isi)).filter(([n]) => /\.csv$/i.test(n));
  const pilih = csv.find(([n]) => /gopay/i.test(n)) ?? csv[0];
  if (!pilih) throw new Error("Tidak ada berkas CSV di dalam ZIP");
  return strFromU8(pilih[1]);
}

export function bacaLaporan(csv: string): { tx: TxGopay[]; dilewati: number } {
  // Semua kolom laporan GoBiz diapit tanda kutip.
  const baris = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim()).map((l) => l.trim().replace(/^"|"$/g, "").split('","'));
  const kepala = baris.shift() ?? [];
  const kol = (n: string) => kepala.indexOf(n);
  const [iW, iS, iR, iH, iM] = [kol("Transaksi Dibuat"), kol("Status"), kol("No. Ref"), kol("Harga"), kol("MDR")];
  if (iW < 0 || iS < 0 || iH < 0) throw new Error("Ini bukan Laporan Transaksi GoPay dari GoBiz (kolom Transaksi Dibuat, Status, Harga tidak ditemukan)");
  const tx: TxGopay[] = [];
  let dilewati = 0;
  for (const b of baris) {
    const t = waktuWib(b[iW] ?? "");
    const nominal = Math.round(Number(b[iH]));
    if (b[iS] !== "SUKSES" || !Number.isFinite(t) || !Number.isFinite(nominal)) { dilewati++; continue; }
    tx.push({ waktu: b[iW], t, nominal, mdr: Number(b[iM]) || 0, ref: b[iR] ?? "" });
  }
  return { tx: tx.sort((a, b) => a.t - b.t), dilewati };
}

export function cocokkan(tx: TxGopay[], dilewati: number, bayar: BayarDb[], lain: OrderLain[]): HasilCocok {
  const awal = tx[0]?.t ?? 0;
  const akhir = tx[tx.length - 1]?.t ?? 0;
  const terpakai = new Set<TxGopay>();
  const tanpaUang: HasilCocok["tanpaUang"] = [];
  let cocok = 0;
  let luarPeriode = 0;
  for (const b of [...bayar].sort((x, y) => x.diterima - y.diterima)) {
    const kena = tx.find((x) => x.nominal === b.nominal && !terpakai.has(x));
    if (kena) { terpakai.add(kena); cocok++; continue; }
    // Pembayaran sebelum transaksi pertama atau order sesudah transaksi terakhir memang tidak ada di laporan ini.
    if (b.diterima < awal || b.dibuat > akhir) { luarPeriode++; continue; }
    tanpaUang.push({ orderId: b.orderId, nama: b.nama, nominal: b.nominal, uji: b.uji });
  }
  const tanpaOrder = tx.filter((x) => !terpakai.has(x)).reverse().map((x) => ({
    waktu: x.waktu, t: x.t, nominal: x.nominal, ref: x.ref,
    kandidat: lain.filter((o) => o.total === x.nominal).map((o) => `${o.id} (${o.status})`),
  }));
  return {
    periode: tx.length ? `${tx[0].waktu} sampai ${tx[tx.length - 1].waktu} WIB` : "",
    jumlah: tx.length, bruto: tx.reduce((s, x) => s + x.nominal, 0), mdr: Math.round(tx.reduce((s, x) => s + x.mdr, 0)),
    dilewati, cocok, luarPeriode, tanpaOrder, tanpaUang, disetujui: [],
  };
}
