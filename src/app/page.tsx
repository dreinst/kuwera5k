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
import { midtrans } from "@/lib/midtrans";
import { getPublicStats } from "@/lib/orders";
import { eventData, remainingQuota } from "@/lib/event-data";

export const metadata: Metadata = pageMeta("/");

// Beranda tetap statis, diperbarui paling lama tiap 60 detik (angka pendaftar setelah go-live).
export const revalidate = 60;

export default async function Home() {
  // Sebelum Midtrans production aktif, hero memakai angka contoh. Begitu MIDTRANS_IS_PRODUCTION=true (go-live),
  // angkanya dari database: data uji sudah dihapus, jadi hitungan mulai dari nol. Kalau database gangguan,
  // hero tetap tampil tanpa angka.
  const stats = midtrans.isProduction
    ? await getPublicStats().catch(() => null)
    : { paid: eventData.paidCount, remaining: remainingQuota };
  return (
    <div className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: homeJsonLd(midtrans.isProduction ? stats?.remaining ?? null : null) }} />
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Hero stats={stats} />
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
