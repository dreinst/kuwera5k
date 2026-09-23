import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import JerseyTexture from "@/components/JerseyTexture";

export const metadata = { title: "Kebijakan privasi KUWERA 5K" };

export default function Page() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-green-deep">
      <JerseyTexture dots="right" />
      <Navbar />
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <h1 className="font-display text-4xl text-white uppercase">Kebijakan privasi</h1>
        <p className="mt-3 text-white/70">Naskah final dari panitia menyusul. Poin di bawah adalah draf sementara.</p>
        <ul className="mt-6 list-disc space-y-3 pl-5 text-white/80">
          <li>Data yang dikumpulkan hanya dipakai untuk keperluan penyelenggaraan KUWERA 5K: BIB, asuransi, race pack, dan komunikasi acara.</li>
          <li>Panitia tidak menyimpan foto KTP dan tidak membagikan data peserta ke pihak lain di luar penyelenggaraan.</li>
          <li>Data peserta dihapus paling lambat enam bulan setelah hari lomba.</li>
        </ul>
      </main>
      <Footer />
    </div>
  );
}
