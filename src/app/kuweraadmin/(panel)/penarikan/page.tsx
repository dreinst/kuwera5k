import type { Metadata } from "next";
import { SUPER, requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getPenarikan, ringkasPenarikan } from "@/lib/penarikan";
import { formatRupiah } from "@/lib/registration";
import PenarikanManager from "@/components/admin/PenarikanManager";
import GopayRincian from "@/components/admin/GopayRincian";
import { gopayRincian } from "@/lib/gopay-rincian";

export const metadata: Metadata = { title: "Penarikan GoPay" };
export const dynamic = "force-dynamic";

export default async function PenarikanPage() {
  await requireAdmin(SUPER);
  const [list, sums, rincian] = await Promise.all([
    getPenarikan(),
    prisma.order.aggregate({ where: { status: "PAID", isTest: false }, _sum: { total: true, uniqueCode: true } }),
    gopayRincian(),
  ]);
  const r = ringkasPenarikan(list);
  const diterima = sums._sum.total ?? 0;
  const kodeUnik = sums._sum.uniqueCode ?? 0;
  const kartu = [
    ["Masuk GoPay", formatRupiah(diterima), "Semua pembayaran lunas (QRIS web dan Kudam)"],
    ["Sudah ditarik", formatRupiah(r.masuk), `Masuk rekening, dari saldo ${formatRupiah(r.saldo)}`],
    ["Potongan tarik", formatRupiah(r.potongan), kodeUnik >= r.potongan
      ? `Tertutup kode unik ${formatRupiah(kodeUnik)}, sisa ${formatRupiah(kodeUnik - r.potongan)}`
      : `Kode unik ${formatRupiah(kodeUnik)}, masih kurang ${formatRupiah(r.potongan - kodeUnik)}`],
  ];
  return (
    <div>
      <h1 className="font-display text-4xl text-white uppercase">Penarikan <span className="text-brand-yellow">GoPay</span></h1>
      <p className="mt-3 max-w-2xl text-white/80">
        Catat setiap penarikan saldo GoPay Merchant ke rekening. GoPay memotong biaya tarik, jadi uang yang masuk rekening
        sedikit lebih kecil; kode unik di nominal QRIS (Rp200 sampai Rp349 per transaksi) dipakai untuk menutup potongan itu.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {kartu.map(([label, nilai, catatan]) => (
          <div key={label} className="rounded-[20px] border border-glass-border bg-card p-5">
            <p className="text-xs font-semibold tracking-wide text-white/75 uppercase">{label}</p>
            <p className="font-display mt-1 text-3xl text-white">{nilai}</p>
            <p className="mt-1 text-sm text-white/75">{catatan}</p>
          </div>
        ))}
      </div>
      <div className="mt-6"><GopayRincian d={rincian} /></div>
      <div className="mt-6"><PenarikanManager list={list} sisaSaldo={diterima - r.saldo} hariIni={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })} /></div>
    </div>
  );
}
