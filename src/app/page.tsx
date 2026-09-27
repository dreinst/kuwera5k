import type { Metadata } from "next";
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
  return (
    <div className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd(live ? stats?.remaining ?? null : null) }} />
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Hero stats={stats} noFee={paymentMode() === "manual"} />
        <RouteDetail />
        <DateBanner />
        <Schedule />
        <Sponsors />
        <CtaBanner />
        <NewsletterFaq />
      </main>
      <Footer />
    </div>
  );
}
