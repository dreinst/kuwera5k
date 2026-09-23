import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Cara KUWERA Fun Run 5K Malang mengumpulkan, memakai, dan menjaga data peserta, termasuk pembayaran lewat Midtrans dan pengukuran iklan.",
  ...pageMeta("/privasi"),
};

export default function Page() {
  return (
    <div className="relative flex flex-1 flex-col">
      <Navbar />
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <h1 className="font-display text-4xl text-white uppercase">Kebijakan privasi</h1>
        <p className="mt-3 text-white/70">Naskah final dari panitia menyusul. Poin di bawah adalah draf sementara.</p>
        <ul className="mt-6 list-disc space-y-3 pl-5 text-white/80">
          <li>Data yang dikumpulkan saat mendaftar: nama, email, nomor HP, NIK di KTP atau KIA, alamat, tanggal lahir, jenis kelamin, golongan darah, kontak darurat, dan ukuran jersey. Data ini hanya dipakai untuk penyelenggaraan KUWERA 5K: BIB, asuransi, verifikasi saat ambil race pack, penanganan darurat medis, dan komunikasi acara.</li>
          <li>NIK hanya dipakai untuk verifikasi identitas dan tidak ditampilkan di e-ticket.</li>
          <li>Panitia tidak menyimpan foto KTP dan tidak membagikan data peserta ke pihak lain di luar penyelenggaraan, kecuali Midtrans untuk pembayaran, Cloudflare untuk pemeriksaan bukan robot, dan Meta untuk pengukuran iklan seperti dijelaskan di bawah.</li>
          <li>Data peserta dihapus paling lambat enam bulan setelah hari lomba.</li>
          <li>Form pendaftaran memakai Cloudflare Turnstile untuk memastikan pendaftar bukan robot. Cloudflare menerima data perangkat dan browser untuk pemeriksaan itu.</li>
          <li>Pembayaran diproses oleh Midtrans. Panitia tidak menerima maupun menyimpan nomor kartu, PIN, atau kata sandi e-wallet.</li>
          <li>Saat iklan berjalan, situs ini memakai Meta Pixel untuk mengukur hasil iklan di Facebook dan Instagram, misalnya berapa kunjungan yang berujung pendaftaran. Meta menerima alamat halaman yang dibuka (di halaman pembayaran dan e-ticket termasuk nomor order), alamat IP, jenis perangkat dan browser, cookie Meta, serta kategori, metode, dan nilai pembayaran. Isi formulir pendaftaran seperti nama, email, dan nomor HP tidak kami kirimkan ke Meta.</li>
        </ul>
      </main>
      <Footer />
    </div>
  );
}
