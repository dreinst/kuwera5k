import { formatRupiah } from "@/lib/registration";
import type { gopayRincian } from "@/lib/gopay-rincian";

type Data = Awaited<ReturnType<typeof gopayRincian>>;
type Baris = { label: string; ket?: string; nilai: number; op?: "tambah" | "kurang"; hasil?: boolean };

function Blok({ judul, baris }: { judul: string; baris: Baris[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold tracking-wide text-white/75 uppercase">{judul}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {baris.map((b) => (
          <div key={b.label} className={`grid grid-cols-[3rem_1fr_auto] items-baseline gap-x-2 ${b.hasil ? "border-t border-white/20 pt-2" : ""}`}>
            <span className={`text-xs ${b.hasil ? "text-brand-yellow" : "text-white/60"}`}>{b.hasil ? "hasil" : b.op ?? ""}</span>
            <dt className={b.hasil ? "font-semibold text-white" : "text-white/85"}>
              {b.label}{b.ket && <span className="block text-xs text-white/60">{b.ket}</span>}
            </dt>
            <dd className={`tabular-nums ${b.hasil ? "font-semibold text-brand-yellow" : "text-white"}`}>{formatRupiah(b.nilai)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Rincian hitungan GoPay Merchant yang bisa dibaca baris per baris (dipakai di dashboard dan halaman Penarikan GoPay).
export default function GopayRincian({ d }: { d: Data }) {
  const masuk: Baris[] = [
    { label: "Harga tiket pendaftar web", ket: `${d.jumlahTiketWeb} tiket dari ${d.transaksiWeb} transaksi`, nilai: d.tiketWeb },
    ...(d.kudam ? [{ label: "Anggota Kudam", ket: `${d.jumlahKudam} tiket, QRIS statis`, nilai: d.kudam, op: "tambah" as const }] : []),
    { label: "Kode unik", ket: `${d.transaksiBerkode} transaksi memakai kode unik Rp200 sampai Rp349`, nilai: d.kodeUnik, op: "tambah" },
    ...(d.biayaLain ? [{ label: "Biaya layanan", nilai: d.biayaLain, op: "tambah" as const }] : []),
    { label: "Total masuk GoPay", nilai: d.masuk, hasil: true },
  ];
  const tarik: Baris[] = [
    { label: "Total masuk GoPay", nilai: d.masuk },
    { label: "Saldo sudah ditarik", ket: d.kaliTarik ? `${d.kaliTarik} kali penarikan` : "belum ada penarikan tercatat", nilai: d.ditarik, op: "kurang" },
    { label: "Sisa saldo di GoPay", nilai: d.sisaSaldo, hasil: true },
  ];
  const rekening: Baris[] = [
    { label: "Saldo sudah ditarik", nilai: d.ditarik },
    { label: "Potongan tarik GoPay", nilai: d.potongan, op: "kurang" },
    { label: "Masuk rekening", nilai: d.masukRekening, hasil: true },
  ];
  const cukup = d.kodeUnik >= d.potongan;
  return (
    <section className="rounded-[20px] border border-glass-border bg-card p-6">
      <h2 className="font-display text-xl text-white uppercase">Rincian perhitungan GoPay Merchant</h2>
      <p className="mt-1 text-sm text-white/75">Cara membaca: uang peserta masuk ke saldo GoPay, lalu ditarik ke rekening dengan potongan dari GoPay. Kode unik di nominal QRIS dipakai untuk menutup potongan itu.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Blok judul="1. Uang masuk ke GoPay" baris={masuk} />
        <Blok judul="2. Saldo GoPay" baris={tarik} />
        <Blok judul="3. Sampai di rekening" baris={rekening} />
      </div>
      <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${cukup ? "bg-yellow-lime/15 text-yellow-lime" : "bg-brand-yellow/10 text-brand-yellow"}`}>
        Kode unik {formatRupiah(d.kodeUnik)} dibanding potongan tarik {formatRupiah(d.potongan)}:{" "}
        {cukup ? `potongan sudah tertutup, sisa ${formatRupiah(d.kodeUnik - d.potongan)}.` : `masih kurang ${formatRupiah(d.potongan - d.kodeUnik)}. Kekurangan ini akan tertutup dari kode unik transaksi berikutnya.`}
      </p>
    </section>
  );
}
