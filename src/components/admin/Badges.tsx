import type { OrderStatus } from "@prisma/client";
import { STATUS_LABEL, type MidtransCheck } from "@/lib/admin-shared";

const STATUS_CLS: Record<OrderStatus, string> = {
  PAID: "bg-brand-yellow text-green-deep",
  PENDING: "bg-white/15 text-white",
  DRAFT: "bg-white/10 text-white/80",
  EXPIRED: "bg-white/10 text-white/70",
  FAILED: "bg-red-500/25 text-red-100",
  REFUNDED: "bg-gold/25 text-cream",
};

// `test`: order data uji, tetap tampil di daftar tapi tidak ikut dihitung di statistik.
export function StatusBadge({ status, test = false }: { status: OrderStatus; test?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_CLS[status]}`}>{STATUS_LABEL[status]}</span>
      {test && <span className="inline-block rounded-full border border-gold px-3 py-1 text-xs font-semibold whitespace-nowrap text-gold">UJI</span>}
    </span>
  );
}

export const VERDICT: Record<MidtransCheck["verdict"], { label: string; cls: string }> = {
  cocok: { label: "Cocok", cls: "bg-yellow-lime text-green-deep" },
  tidak_cocok: { label: "Tidak cocok", cls: "bg-red-500/30 text-red-50" },
  belum_bayar: { label: "Belum bayar", cls: "bg-white/15 text-white" },
  simulasi: { label: "Simulasi", cls: "border border-gold text-gold" },
  tidak_ada: { label: "Belum ada transaksi", cls: "bg-white/10 text-white/80" },
  error: { label: "Gagal cek", cls: "bg-orange-500/30 text-orange-50" },
};

export function VerdictBadge({ verdict }: { verdict: MidtransCheck["verdict"] }) {
  const v = VERDICT[verdict];
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${v.cls}`}>{v.label}</span>;
}
