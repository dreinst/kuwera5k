import type { Metadata } from "next";
import { SCAN, requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import RegUlangScanner from "@/components/admin/RegUlangScanner";

export const metadata: Metadata = { title: "Reg ulang race pack" };
export const dynamic = "force-dynamic";

// Khusus superadmin dan petugas race pack. Angka di atas ikut diperbarui otomatis (AutoRefresh di layout).
export default async function RegUlangPage() {
  await requireAdmin(SCAN);
  const where = { order: { status: "PAID" as const } };
  const [total, collected] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, racepackCollectedAt: { not: null } } }),
  ]);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-4xl text-white uppercase">Reg ulang <span className="text-brand-yellow">race pack</span></h1>
      <p className="mt-3 text-white/85">
        <span className="font-display text-3xl text-brand-yellow">{collected.toLocaleString("id-ID")}</span> dari {total.toLocaleString("id-ID")} peserta sudah mengambil race pack
        {total > collected && <>, {(total - collected).toLocaleString("id-ID")} belum</>}.
      </p>
      <div className="mt-6"><RegUlangScanner /></div>
    </div>
  );
}
