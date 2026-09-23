import { waLink, waText } from "@/lib/whatsapp";

// Baris seperti konsep (hak cipta kiri, logo tengah, tautan kanan), lalu kredit standar grup D'Pro di bawahnya.
export default function Footer() {
  return (
    <footer id="kontak" className="relative border-t border-white/10 px-6 pt-10 pb-28">
      <div className="mx-auto grid max-w-6xl items-center gap-6 text-center sm:grid-cols-[1fr_auto_1fr] sm:text-left">
        <p className="order-3 text-xs text-white/75 sm:order-1">
          &copy; {new Date().getFullYear()} KUWERA 5K. Semua hak dilindungi.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
        <img src="/brand/kuwera-logo-light.svg" alt="KUWERA Fun Run" width={2400} height={853} className="order-1 mx-auto h-12 w-auto sm:order-2" />
        <nav aria-label="Kontak dan legal" className="order-2 flex flex-col items-center gap-2 text-sm text-white/85 sm:order-3 sm:items-end">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-end">
            <a href={waLink(waText.umum)} target="_blank" rel="noopener noreferrer" className="hover:text-brand-yellow">
              WhatsApp Panitia
            </a>
            <a href="mailto:halo@kuwera5k.id" className="hover:text-brand-yellow">
              halo@kuwera5k.id
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-end">
            <a href="/syarat" className="hover:text-brand-yellow">
              Syarat &amp; Ketentuan
            </a>
            <a href="/privasi" className="hover:text-brand-yellow">
              Kebijakan Privasi
            </a>
          </div>
        </nav>
      </div>

      {/* Kredit standar situs grup D'Pro (sama dengan Produksia, Pet Blessing, EasyLearnn): logo di atas, satu baris kredit di bawahnya, terpusat. */}
      <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center gap-2 border-t border-white/10 pt-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG statis, tanpa optimasi */}
        <img src="/logo-dpro.svg" alt="D'Production Event Organizer" width={322} height={163} className="h-12 w-auto" />
        <p className="text-xs text-white/80">Made by dreinst, organized by D&rsquo;Production Event Organizer</p>
      </div>
    </footer>
  );
}
