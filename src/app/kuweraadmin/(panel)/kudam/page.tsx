import type { Metadata } from "next";
import { SUPER, requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import KudamManager from "@/components/admin/KudamManager";

export const metadata: Metadata = { title: "Anggota Kudam" };
export const dynamic = "force-dynamic";

// Pendaftaran anggota Kudam V/Brawijaya oleh superadmin: harga tetap, bayar QRIS statis, e-ticket dikirim bot setelah lunas.
export default async function KudamPage() {
  await requireAdmin(SUPER);
  const orders = await prisma.order.findMany({
    where: { source: "kudam" },
    orderBy: { createdAt: "asc" },
    include: { participants: { take: 1, orderBy: { position: "asc" }, include: { ticket: { select: { code: true } } } } },
  });
  const members = orders.map((o) => ({
    id: o.id, nama: o.participants[0]?.fullName ?? "-", wa: o.buyerPhone, jersey: o.participants[0]?.jerseySize ?? "-",
    status: o.status, tiket: o.participants[0]?.ticket?.code ?? null, dibuat: o.createdAt.toISOString(),
  }));
  return (
    <div>
      <h1 className="font-display text-4xl text-white uppercase">Anggota <span className="text-brand-yellow">Kudam</span></h1>
      <p className="mt-3 max-w-2xl text-white/80">
        Pendaftaran khusus anggota Kudam V/Brawijaya dengan harga tetap Rp125.000 per orang. Tidak memakai kuota Early Bird,
        tetapi tetap masuk kuota total peserta. Setelah ditandai lunas, tautan e-ticket dan QR registrasi ulang ada di halaman peserta untuk dibagikan ke tiap anggota (bot WhatsApp sedang tidak aktif).
      </p>
      <div className="mt-6"><KudamManager members={members} price={125000} /></div>
    </div>
  );
}
