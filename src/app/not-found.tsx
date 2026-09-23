import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";

export const metadata = { title: "Halaman tidak ditemukan" };

export default function NotFound() {
  return (
    <div className="relative flex flex-1 flex-col">
      <Navbar />
      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pt-32 pb-24 text-center">
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">404</p>
        <h1 className="font-display mt-2 text-4xl text-white uppercase">Halaman tidak ditemukan</h1>
        <p className="mt-3 text-white/75">Alamatnya mungkin salah ketik atau halamannya sudah tidak ada.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep">Ke beranda</Link>
          <Link href="/daftar" className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white">Daftar sekarang</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
