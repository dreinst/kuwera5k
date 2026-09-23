import type { Metadata } from "next";
import Navbar from "@/components/sections/Navbar";
import Hero from "@/components/sections/Hero";
import RouteDetail from "@/components/sections/RouteDetail";
import DateBanner from "@/components/sections/DateBanner";
import Sponsors from "@/components/sections/Sponsors";
import CtaBanner from "@/components/sections/CtaBanner";
import NewsletterFaq from "@/components/sections/NewsletterFaq";
import Footer from "@/components/sections/Footer";
import { eventJsonLd } from "@/lib/structured-data";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta("/");

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: eventJsonLd() }} />
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Hero />
        <RouteDetail />
        <DateBanner />
        <Sponsors />
        <CtaBanner />
        <NewsletterFaq />
      </main>
      <Footer />
    </div>
  );
}
