import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";

export const metadata = { title: "Syarat dan ketentuan KUWERA 5K" };

export default function Page() {
  return (
    <div className="flex flex-1 flex-col bg-green-deep">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <h1 className="font-display text-4xl text-white uppercase">Syarat dan ketentuan</h1>
        <p className="mt-3 text-white/70">Naskah final dari panitia menyusul. Poin di bawah adalah draf sementara.</p>
        <ul className="mt-6 list-disc space-y-3 pl-5 text-white/80">
          <li>Peserta minimal berusia 12 tahun pada hari lomba dan dalam kondisi sehat untuk berlari 5 km.</li>
          <li>Pendaftaran bersifat perorangan, satu peserta per transaksi, dan tidak dapat dipindahtangankan.</li>
          <li>Biaya pendaftaran yang sudah lunas tidak dapat dikembalikan.</li>
          <li>Race pack diambil sendiri dengan menunjukkan e-ticket dan KTP asli pada jadwal yang ditentukan.</li>
          <li>Panitia berhak mengubah rute atau jadwal karena kondisi cuaca atau keamanan.</li>
        </ul>
      </main>
      <Footer />
    </div>
  );
}
