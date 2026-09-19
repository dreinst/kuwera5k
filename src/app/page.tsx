import Navbar from "@/components/sections/Navbar";
import Hero from "@/components/sections/Hero";
import RouteDetail from "@/components/sections/RouteDetail";
import DateBanner from "@/components/sections/DateBanner";
import GuestStar from "@/components/sections/GuestStar";
import Sponsors from "@/components/sections/Sponsors";
import CtaBanner from "@/components/sections/CtaBanner";
import NewsletterFaq from "@/components/sections/NewsletterFaq";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col">
        <Hero />
        <RouteDetail />
        <DateBanner />
        <GuestStar />
        <Sponsors />
        <CtaBanner />
        <NewsletterFaq />
      </main>
      <Footer />
    </div>
  );
}
