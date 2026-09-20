import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import RegistrationForm from "@/components/registration/RegistrationForm";
import { getOpenCategories, getSettings, paymentMode } from "@/lib/orders";

export const dynamic = "force-dynamic";

export const metadata = { title: "Daftar KUWERA 5K" };

export default async function DaftarPage() {
  const [categories, settings] = await Promise.all([getOpenCategories(), getSettings()]);
  return (
    <div className="flex flex-1 flex-col bg-green-deep">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-28 pb-24">
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">Pendaftaran</p>
        <h1 className="font-display mt-2 text-4xl text-white uppercase sm:text-5xl">
          Daftar <span className="text-brand-yellow">KUWERA 5K</span>
        </h1>
        <p className="mt-3 max-w-xl text-white/70">
          Empat langkah, sekitar tiga menit. Isianmu tersimpan otomatis di perangkat ini selama 24 jam.
        </p>
        <div className="mt-8">
          <RegistrationForm categories={categories} fees={settings.fees} paymentMode={paymentMode()} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
