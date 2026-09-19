export default function Footer() {
  return (
    <footer id="kontak" className="border-t border-white/10 bg-green-deep px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="font-display text-xl tracking-wide text-white">
            KUWERA<span className="text-brand-yellow">5K</span>
          </span>
          <p className="mt-2 max-w-xs text-sm text-white/50">
            Fun run 5K di Malang, Jawa Timur. Diselenggarakan untuk mengajak masyarakat hidup sehat lewat lari.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm sm:flex sm:gap-16">
          <div>
            <p className="font-semibold text-white">Kontak</p>
            <a href="https://wa.me/6281234567890" className="mt-2 block text-white/60 hover:text-brand-yellow">
              WhatsApp Panitia
            </a>
            <a href="mailto:halo@kuwera5k.id" className="mt-1 block text-white/60 hover:text-brand-yellow">
              halo@kuwera5k.id
            </a>
          </div>
          <div>
            <p className="font-semibold text-white">Legal</p>
            <a href="/syarat" className="mt-2 block text-white/60 hover:text-brand-yellow">
              Syarat &amp; Ketentuan
            </a>
            <a href="/privasi" className="mt-1 block text-white/60 hover:text-brand-yellow">
              Kebijakan Privasi
            </a>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-6xl text-xs text-white/30">
        &copy; {new Date().getFullYear()} KUWERA 5K. Semua hak dilindungi.
      </p>
    </footer>
  );
}
