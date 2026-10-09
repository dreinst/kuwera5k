import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import CariRefund from "@/components/refund/CariRefund";
import { REFUND_PROSES, getRefund, refundBatas, tglPanjang } from "@/lib/refund";
import { waLink, waText } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengembalian dana",
  description: "KUWERA Fun Run 5K 2026 dibatalkan. Uang pendaftaran dikembalikan 100% termasuk kode unik. Cara mengajukan pengembalian dana ada di halaman ini.",
};

export default async function RefundPage() {
  const cfg = await getRefund();
  if (!cfg) notFound();
  const batas = refundBatas(cfg);
  return (
    <div className="relative flex flex-1 flex-col">
      <Navbar />
      <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-28 pb-24">
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">Pengumuman panitia</p>
        <h1 className="font-display mt-2 text-4xl text-white uppercase sm:text-5xl">
          Mohon maaf, KUWERA Fun Run 5K <span className="text-brand-yellow">dibatalkan</span>
        </h1>
        <p className="mt-4 text-white/80">
          Dengan berat hati kami sampaikan bahwa KUWERA Fun Run 5K 2026 batal diselenggarakan. Kami mohon maaf kepada semua pelari yang sudah mendaftar dan menantikan hari lomba.
        </p>

        <section className="mt-8 rounded-[20px] bg-brand-yellow p-6 text-green-deep">
          <h2 className="font-display text-2xl uppercase">Uang pendaftaranmu kembali 100%</h2>
          <p className="mt-2 font-medium">Jumlahnya sama dengan yang kamu bayar, termasuk kode unik di ujung nominal. Biaya transfernya kami yang tanggung.</p>
        </section>

        <section className="mt-6 rounded-[20px] border border-glass-border bg-card p-6">
          <h2 className="font-display text-xl text-white uppercase">Cara mengajukan</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-white/85">
            <li>Buka tautan refund pribadimu. Tautannya kami kirim ke email yang kamu pakai saat mendaftar, dan bisa juga kamu minta lewat <a href={waLink(waText.refund)} target="_blank" rel="noopener noreferrer" className="text-brand-yellow underline">WhatsApp panitia</a>.</li>
            <li>Periksa data tiket dan nominalnya, lalu isi rekening bank atau dompet digital tujuan.</li>
            <li>Dana kami transfer {REFUND_PROSES} setelah data rekeningmu lengkap. Bukti transfernya kami kirim ke emailmu.</li>
          </ol>
          {batas && (
            <p className="mt-4 text-sm text-white/75">
              Pengajuan kami buka sampai {tglPanjang(batas)}. Kalau terlewat, kamu tetap bisa menghubungi panitia lewat WhatsApp.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-[20px] border border-glass-border bg-card p-6">
          <h2 className="font-display text-xl text-white uppercase">Belum menerima tautannya?</h2>
          <p className="mt-2 mb-5 text-sm text-white/75">Isi nomor order dan email saat mendaftar. Tautan refund kami kirim ke email itu. Nomor order tertulis di email e-ticket.</p>
          <CariRefund />
        </section>
      </main>
      <Footer />
    </div>
  );
}
