import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import RegistrationForm from "@/components/registration/RegistrationForm";
import { getOpenCategories, getSettings, paymentMode, trackCheckout } from "@/lib/orders";
import { getPricing, isOpen, nextPromoAt } from "@/lib/pricing";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pendaftaran Online",
  description:
    "Daftar online KUWERA Fun Run 5K Malang. Harga tiket sudah termasuk jersey, BIB, dan medali, bisa beli beberapa tiket sekaligus, bayar lewat QRIS, e-ticket terbit setelah pembayaran dikonfirmasi.",
  ...pageMeta("/daftar"),
};

export default async function DaftarPage() {
  const now = new Date();
  const [categories, settings, pricing, promoCount] = await Promise.all([
    getOpenCategories(), getSettings(), getPricing(),
    prisma.promoCode.count({ where: { isActive: true, validFrom: { lte: now }, validUntil: { gt: now } } }),
  ]);
  const closed = !isOpen(pricing);
  const opensAt = closed && pricing.open && pricing.openAt ? new Date(pricing.openAt) : null;
  const mode = paymentMode();
  const promoNext = nextPromoAt(pricing, now);
  return (
    <div className="relative flex flex-1 flex-col">
      <Navbar />
      <main className="relative mx-auto w-full max-w-3xl flex-1 px-6 pt-28 pb-24">
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">Pendaftaran</p>
        <h1 className="font-display mt-2 text-4xl text-white uppercase sm:text-5xl">
          Daftar <span className="text-brand-yellow">KUWERA 5K</span>
        </h1>
        <p className="mt-3 max-w-xl text-white/70">
          {closed
            ? "Sambil menunggu, yuk siapkan kartu identitas (KTP atau KIA), kontak darurat, dan ukuran jersey kamu, ya."
            : "Cukup empat langkah, sekitar tiga menit. Tenang saja, isianmu tersimpan otomatis di perangkat ini selama 24 jam."}
        </p>
        {!closed && promoNext && pricing.promo.daily && (
          <p className="mt-3 max-w-xl text-sm font-semibold text-brand-yellow">
            Harga {pricing.promo.label} Rp{pricing.promo.price.toLocaleString("id-ID")} buka lagi{" "}
            {new Date(promoNext).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long" })} pukul{" "}
            {pricing.promo.daily.from.replace(":", ".")} sampai {pricing.promo.daily.to.replace(":", ".")} WIB, kuotanya terbatas.
          </p>
        )}
        <div className="mt-8">
          {closed ? (
            <div className="rounded-[20px] border border-glass-border bg-card p-8 text-center">
              <p className="font-display text-2xl text-brand-yellow uppercase">{opensAt ? "Pendaftaran segera dibuka" : "Pendaftaran sedang ditutup"}</p>
              <p className="mt-2 text-white/75">
                {opensAt
                  ? `Pendaftaran dibuka ${opensAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} WIB. Sampai jumpa di garis start!`
                  : "Kalau ingin tahu jadwal pembukaan berikutnya, panitia siap membantu lewat WhatsApp."}
              </p>
            </div>
          ) : (
            <RegistrationForm
              categories={categories} fees={settings.fees} methods={settings.methods} paymentMode={mode} trackCheckout={trackCheckout()}
              maxTickets={settings.maxTickets} holdMinutes={mode === "manual" ? settings.manualHoldMinutes : settings.holdMinutes} promoAvailable={promoCount > 0}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
