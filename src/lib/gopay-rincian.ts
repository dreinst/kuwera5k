import { prisma } from "@/lib/db";
import { getPenarikan, ringkasPenarikan } from "@/lib/penarikan";

// Angka untuk kartu rincian GoPay Merchant: dari mana total uang masuk, berapa yang sudah ditarik, dan apakah kode
// unik cukup menutup potongan tarik. Semua order lunas tanpa data uji (pendaftar web dan anggota Kudam).
export async function gopayRincian() {
  const lunas = { status: "PAID" as const, isTest: false };
  const [web, kudam, berkode, penarikan] = await Promise.all([
    prisma.order.aggregate({ where: { ...lunas, source: "web" }, _sum: { subtotal: true, discount: true, fee: true, uniqueCode: true, total: true, quantity: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { ...lunas, source: "kudam" }, _sum: { total: true, quantity: true } }),
    prisma.order.count({ where: { ...lunas, uniqueCode: { gt: 0 } } }),
    getPenarikan(),
  ]);
  const r = ringkasPenarikan(penarikan);
  const tiketWeb = (web._sum.subtotal ?? 0) - (web._sum.discount ?? 0);
  const masuk = (web._sum.total ?? 0) + (kudam._sum.total ?? 0);
  return {
    tiketWeb, jumlahTiketWeb: web._sum.quantity ?? 0, transaksiWeb: web._count._all,
    kudam: kudam._sum.total ?? 0, jumlahKudam: kudam._sum.quantity ?? 0,
    kodeUnik: web._sum.uniqueCode ?? 0, transaksiBerkode: berkode,
    biayaLain: web._sum.fee ?? 0,
    masuk, ditarik: r.saldo, masukRekening: r.masuk, potongan: r.potongan, sisaSaldo: masuk - r.saldo, kaliTarik: penarikan.length,
  };
}
