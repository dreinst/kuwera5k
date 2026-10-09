import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import { REFUND_PROSES, refundAktif } from "@/lib/refund";

export const metadata: Metadata = {
  title: "Syarat dan Ketentuan",
  description: "Syarat dan ketentuan KUWERA Fun Run 5K Malang 2026: ketentuan usia peserta, satu tiket untuk satu peserta, pengembalian dana, pengambilan race pack, dan perubahan rute.",
  ...pageMeta("/syarat"),
};

export default async function Page() {
  const batal = await refundAktif();
  return (
    <div className="relative flex flex-1 flex-col">
      <Navbar />
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <h1 className="font-display text-4xl text-white uppercase">Syarat dan ketentuan</h1>
        <p className="mt-3 text-white/70">Naskah final dari panitia menyusul. Poin di bawah adalah draf sementara.</p>
        <ul className="mt-6 list-disc space-y-3 pl-5 text-white/80">
          <li>Tidak ada batasan usia, dan kami sarankan peserta mulai usia SD. Peserta usia SMP ke atas wajib terdaftar dan membayar biaya pendaftaran. Anak usia SD boleh ikut berlari tanpa tiket (tanpa jersey, BIB, dan medali), atau mendaftar dan membayar seperti peserta lain kalau ingin mendapatkan jersey, BIB, dan medali finisher.</li>
          <li>Peserta dalam kondisi sehat untuk berlari 5 km.</li>
          <li>Satu tiket berlaku untuk satu peserta sesuai data yang diisi dan tidak dapat dipindahtangankan. Satu pembelian boleh berisi beberapa tiket.</li>
          {batal ? (
            <li>Acara dibatalkan oleh panitia, jadi biaya pendaftaran yang sudah lunas dikembalikan 100% termasuk kode unik, dan biaya transfernya ditanggung panitia. Pengembalian diajukan lewat halaman <Link href="/refund" className="text-brand-yellow underline">refund</Link>, lalu dana ditransfer {REFUND_PROSES} setelah data rekening lengkap. Tiket tidak berlaku lagi setelah dana diterima.</li>
          ) : (
            <li>Biaya pendaftaran yang sudah lunas tidak dikembalikan secara otomatis. Kasus khusus bisa diajukan ke panitia lewat WhatsApp.</li>
          )}
          <li>Race pack diambil pada jadwal pengambilan dengan membawa e-ticket dan KTP atau KIA asli. Boleh diambilkan orang lain yang membawa surat keterangan dari peserta, dan panitia akan memastikan ke peserta lewat WhatsApp atau telepon. Di hari lomba tidak ada pengambilan, dan race pack yang tidak diambil sampai jadwal berakhir dianggap hangus.</li>
          <li>Panitia berhak mengubah rute atau jadwal karena kondisi cuaca atau keamanan.</li>
        </ul>
      </main>
      <Footer />
    </div>
  );
}
