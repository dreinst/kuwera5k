import { waLink, waText } from "@/lib/whatsapp";

export default function Footer() {
  return (
    <footer id="kontak" className="relative border-t border-white/10 px-6 pt-12 pb-28">
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
          <img src="/brand/kuwera-logo-light.svg" alt="KUWERA Fun Run" width={2400} height={853} className="h-11 w-auto" />
          <p className="mt-2 max-w-xs text-sm text-white/75">
            Fun run 5K di Malang, Jawa Timur. Start dan finish di Lapangan Rampal.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm sm:flex sm:gap-16">
          <div>
            <p className="font-semibold text-white">Kontak</p>
            <a href={waLink(waText.umum)} target="_blank" rel="noopener noreferrer" className="mt-2 block text-white/80 hover:text-brand-yellow">
              WhatsApp Panitia
            </a>
            <a href="mailto:halo@kuwera5k.id" className="mt-1 block text-white/80 hover:text-brand-yellow">
              halo@kuwera5k.id
            </a>
          </div>
          <div>
            <p className="font-semibold text-white">Legal</p>
            <a href="/syarat" className="mt-2 block text-white/80 hover:text-brand-yellow">
              Syarat &amp; Ketentuan
            </a>
            <a href="/privasi" className="mt-1 block text-white/80 hover:text-brand-yellow">
              Kebijakan Privasi
            </a>
          </div>
        </div>
      </div>

      {/* Kredit standar situs grup D'Pro (sama dengan Produksia, Pet Blessing, EasyLearnn): logo di atas, satu baris kredit di bawahnya, terpusat. */}
      <div className="relative mx-auto mt-10 max-w-6xl border-t border-white/10 pt-6 text-center">
        <p className="text-xs text-white/70">
          &copy; {new Date().getFullYear()} KUWERA 5K. Semua hak dilindungi.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG statis, tanpa optimasi */}
          <img src="/logo-dpro.svg" alt="D'Production Event Organizer" className="h-12 w-auto" />
          <p className="text-xs text-white/80">Made by dreinst, organized by D&rsquo;Production Event Organizer</p>
        </div>
      </div>
    </footer>
  );
}
