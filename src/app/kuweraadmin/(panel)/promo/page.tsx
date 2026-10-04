import type { Metadata } from "next";
import { SUPER, requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { activeOrderWhere } from "@/lib/orders";
import { formatRupiah } from "@/lib/registration";
import PromoForm, { type PromoInput } from "@/components/admin/PromoForm";

export const metadata: Metadata = { title: "Kode promo" };
export const dynamic = "force-dynamic";

const nilai = (p: PromoInput) =>
  p.discountType === "flat" ? `Harga khusus ${formatRupiah(p.discountValue)} per tiket`
    : p.discountType === "percent" ? `Diskon ${p.discountValue}%` : `Potongan ${formatRupiah(p.discountValue)} per order`;
const wib = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function PromoPage() {
  await requireAdmin(SUPER);
  const now = new Date();
  const rows = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  const promos = await Promise.all(rows.map(async (r) => {
    const agg = await prisma.order.aggregate({ _sum: { quantity: true }, where: { promoCode: r.code, ...activeOrderWhere(now) } });
    return {
      promo: { code: r.code, discountType: r.discountType, discountValue: r.discountValue, quota: r.quota,
        validFrom: r.validFrom.toISOString(), validUntil: r.validUntil.toISOString(), isActive: r.isActive } as PromoInput,
      terpakai: agg._sum.quantity ?? 0,
      berlaku: r.isActive && now >= r.validFrom && now <= r.validUntil,
    };
  }));
  return (
    <div>
      <h1 className="font-display text-4xl text-white uppercase">Kode <span className="text-brand-yellow">promo</span></h1>
      <p className="mt-3 max-w-2xl text-white/80">
        Buat dan atur kode promo. Kuota dihitung per orang (tiket) dari order lunas dan order yang masih menunggu bayar; order yang
        kedaluwarsa otomatis mengembalikan jatahnya. Kolom kode promo di halaman daftar hanya muncul kalau ada kode yang aktif.
      </p>
      <div className="mt-6 grid gap-4">
        {promos.length === 0 && <p className="text-white/70">Belum ada kode promo.</p>}
        {promos.map(({ promo, terpakai, berlaku }) => (
          <details key={promo.code} className="rounded-[20px] border border-glass-border bg-card p-5">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <span className="font-display text-2xl text-brand-yellow">{promo.code}</span>
              <span className="text-sm text-white/85">{nilai(promo)}</span>
              <span className="text-sm text-white/85">Terpakai {terpakai} dari {promo.quota} orang</span>
              <span className="text-sm text-white/70">Berlaku {wib(promo.validFrom)} sampai {wib(promo.validUntil)} WIB</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${berlaku ? "bg-brand-yellow text-green-deep" : "bg-white/15 text-white"}`}>
                {berlaku ? "Aktif" : promo.isActive ? "Di luar masa berlaku" : "Nonaktif"}
              </span>
            </summary>
            <div className="mt-5 border-t border-glass-border pt-5">
              <PromoForm promo={promo} />
            </div>
          </details>
        ))}
      </div>
      <div className="mt-8 rounded-[20px] border border-glass-border bg-card p-6">
        <h2 className="font-display text-xl text-white uppercase">Tambah kode promo</h2>
        <div className="mt-4"><PromoForm /></div>
      </div>
    </div>
  );
}
