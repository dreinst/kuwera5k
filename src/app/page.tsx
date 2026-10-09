import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Hero from "@/components/sections/Hero";
import RouteDetail from "@/components/sections/RouteDetail";
import DateBanner from "@/components/sections/DateBanner";
import Schedule from "@/components/sections/Schedule";
import Sponsors from "@/components/sections/Sponsors";
import CtaBanner from "@/components/sections/CtaBanner";
import NewsletterFaq from "@/components/sections/NewsletterFaq";
import Footer from "@/components/sections/Footer";
import { homeJsonLd } from "@/lib/structured-data";
import { pageMeta } from "@/lib/site";
import { getPublicStats, isLive, paymentMode } from "@/lib/orders";
import { eventData, remainingQuota } from "@/lib/event-data";
import { refundAktif } from "@/lib/refund";
import { waLink, waText } from "@/lib/whatsapp";
import { DEFAULT_PRICING, currentPrice, getPricing, isOpen, nextPromoAt, promoEndsAt } from "@/lib/pricing";

export const metadata: Metadata = pageMeta("/");

// Beranda tetap statis, diperbarui paling lama tiap 60 detik (angka pendaftar setelah go-live).
export const revalidate = 60;

export default async function Home() {
  // Sebelum pendaftaran menerima uang sungguhan, hero memakai angka contoh. Setelah go-live (Midtrans
  // production atau bayar manual QRIS) angkanya dari database: data uji sudah dihapus, jadi hitungan mulai
  // dari nol. Kalau database gangguan, hero tetap tampil tanpa angka.
  const live = isLive();
  const stats = live
    ? await getPublicStats().catch(() => null)
    : { paid: eventData.paidCount, remaining: remainingQuota };
  // Acara dibatalkan: beranda berganti menjadi pengumuman, tanpa hitung mundur, harga, dan ajakan mendaftar.
  if (await refundAktif()) {
    return (
      <div className="flex flex-1 flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd(null, DEFAULT_PRICING.regular.price, true) }} />
        <Navbar />
        <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 pt-32 pb-24 text-center">
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">Pengumuman panitia</p>
          <h1 className="font-display mt-3 text-5xl text-white uppercase sm:text-6xl">
            KUWERA Fun Run 5K <span className="text-brand-yellow">dibatalkan</span>
          </h1>
          <p className="mt-5 text-lg text-white/80">
            Dengan berat hati kami sampaikan bahwa KUWERA Fun Run 5K 2026 batal diselenggarakan. Kami mohon maaf kepada semua pelari yang sudah mendaftar dan menantikan hari lomba.
          </p>
          <div className="mt-8 rounded-[20px] bg-brand-yellow p-6 text-green-deep">
            <p className="font-display text-2xl uppercase">Uang pendaftaran kembali 100%</p>
            <p className="mt-2 font-medium">Termasuk kode unik di ujung nominal, dan biaya transfernya kami yang tanggung.</p>
            <Link href="/refund" className="mt-5 inline-block rounded-full bg-green-deep px-7 py-3 text-sm font-semibold text-brand-yellow">Ajukan refund</Link>
          </div>
          <p className="mt-6 text-sm text-white/75">
            Ada pertanyaan? Panitia siap membantu lewat <a href={waLink(waText.refund)} target="_blank" rel="noopener noreferrer" className="underline">WhatsApp</a>.
          </p>
        </main>
        <Footer />
      </div>
    );
  }
  const pricing = await getPricing().catch(() => DEFAULT_PRICING);
  const price = currentPrice(pricing);
  return (
    <div className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd(live ? stats?.remaining ?? null : null, price.price) }} />
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Hero stats={stats} price={price} promoEnd={promoEndsAt(pricing)}
          promoNext={nextPromoAt(pricing)} promo={pricing.promo}
          promoDay={isOpen(pricing) && new Date() >= new Date(eventData.promoDay.fromIso) && new Date() <= new Date(eventData.promoDay.untilIso) ? eventData.promoDay : null} noFee={paymentMode() === "manual"} />
        <RouteDetail />
        <DateBanner />
        <Schedule />
        <Sponsors />
        <CtaBanner price={price.price} />
        <NewsletterFaq />
      </main>
      <Footer />
    </div>
  );
}
