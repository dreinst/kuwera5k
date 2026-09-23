import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { midtrans } from "@/lib/midtrans";
import VerifyAll from "@/components/admin/VerifyAll";

export const metadata: Metadata = { title: "Verifikasi Midtrans" };
export const dynamic = "force-dynamic";

export default async function VerifikasiPage() {
  await requireAdmin({ role: "admin" });
  return (
    <div>
      <h1 className="font-display text-4xl text-white uppercase">Verifikasi <span className="text-brand-yellow">Midtrans</span></h1>
      <p className="mt-3 max-w-2xl text-white/80">
        Setiap order yang pernah membuka pembayaran atau tercatat lunas dicocokkan dengan status resmi di Midtrans
        ({midtrans.isProduction ? "production" : "sandbox"}): status transaksi dan nominalnya. Hasil &ldquo;Tidak cocok&rdquo; perlu dicek
        di halaman detail peserta.
      </p>
      <div className="mt-8 rounded-[20px] border border-glass-border bg-card p-6">
        <VerifyAll />
      </div>
    </div>
  );
}
