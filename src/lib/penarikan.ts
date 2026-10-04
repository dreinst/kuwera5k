import { prisma } from "@/lib/db";

// Penarikan saldo GoPay Merchant ke rekening, dicatat superadmin. GoPay memotong biaya tarik, jadi yang masuk rekening
// lebih kecil dari saldo yang ditarik; kode unik di nominal QRIS dipakai untuk menutup potongan itu.
export type Penarikan = { id: string; tanggal: string; saldo: number; masuk: number; catatan: string; oleh: string; dibuat: string };

export const PENARIKAN_KEY = "gopay.penarikan";

export async function getPenarikan(): Promise<Penarikan[]> {
  const row = await prisma.setting.findUnique({ where: { key: PENARIKAN_KEY } });
  return Array.isArray(row?.value) ? (row.value as Penarikan[]) : [];
}

export const ringkasPenarikan = (list: Penarikan[]) => {
  const saldo = list.reduce((n, p) => n + p.saldo, 0);
  const masuk = list.reduce((n, p) => n + p.masuk, 0);
  return { saldo, masuk, potongan: saldo - masuk };
};
