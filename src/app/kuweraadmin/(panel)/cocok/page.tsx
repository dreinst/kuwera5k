import type { Metadata } from "next";
import { SUPER, requireAdmin } from "@/lib/admin-auth";
import CocokGopay from "@/components/admin/CocokGopay";

export const metadata: Metadata = { title: "Cocokkan GoPay" };
export const dynamic = "force-dynamic";

export default async function CocokPage() {
  await requireAdmin(SUPER);
  return (
    <div>
      <h1 className="font-display text-4xl text-white uppercase">Cocokkan <span className="text-brand-yellow">GoPay</span></h1>
      <p className="mt-3 max-w-2xl text-white/80">
        Unggah laporan transaksi GoPay Merchant untuk memastikan setiap uang yang masuk sudah punya order lunas, dan setiap order lunas memang ada uangnya.
      </p>
      <div className="mt-6"><CocokGopay /></div>
    </div>
  );
}
