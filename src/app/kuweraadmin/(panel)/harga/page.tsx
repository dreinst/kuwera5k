import type { Metadata } from "next";
import { SUPER, requireAdmin } from "@/lib/admin-auth";
import { currentPrice, getPricing, isOpen, promoLeft } from "@/lib/pricing";
import { formatRupiah } from "@/lib/registration";
import PricingForm from "@/components/admin/PricingForm";

export const metadata: Metadata = { title: "Harga" };
export const dynamic = "force-dynamic";

export default async function HargaPage() {
  await requireAdmin(SUPER);
  const pricing = await getPricing();
  const now = currentPrice(pricing);
  const open = isOpen(pricing);
  return (
    <div>
      <h1 className="font-display text-4xl text-white uppercase">Harga <span className="text-brand-yellow">tiket</span></h1>
      <p className="mt-3 max-w-2xl text-white/80">
        Buka atau tutup pendaftaran, atur harga promo (misalnya Early Bird) beserta jadwalnya, dan harga normal. Perubahan
        berlaku untuk order baru; order yang sudah dibuat tetap memakai harga saat dibuat.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-glass-border bg-card p-5">
          <p className="text-sm text-white/70">Status pendaftaran sekarang</p>
          <p className={`font-display mt-1 text-2xl uppercase ${open ? "text-brand-yellow" : "text-white"}`}>{open ? "Dibuka" : "Ditutup"}</p>
        </div>
        <div className="rounded-[20px] border border-glass-border bg-card p-5">
          <p className="text-sm text-white/70">Harga yang berlaku sekarang</p>
          <p className="font-display mt-1 text-2xl text-brand-yellow">{formatRupiah(now.price)} <span className="text-white">&middot; {now.label}</span></p>
          {pricing.promo.quota ? (
            <p className="mt-1 text-sm text-white/75">
              Kuota {pricing.promo.label}: {(pricing.promoUsed ?? 0).toLocaleString("id-ID")} dari {pricing.promo.quota.toLocaleString("id-ID")} tiket terpakai, sisa {promoLeft(pricing)?.toLocaleString("id-ID")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-6 rounded-[20px] border border-glass-border bg-card p-6">
        <PricingForm pricing={pricing} />
      </div>
    </div>
  );
}
