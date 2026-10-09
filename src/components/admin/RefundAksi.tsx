"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refundPerbaikanAction } from "@/app/kuweraadmin/refund-actions";
import { inputCls } from "@/components/admin/LoginForm";

export function SalinTautan({ link }: { link: string }) {
  const [pesan, setPesan] = useState("");
  const salin = async () => {
    try { await navigator.clipboard.writeText(link); setPesan("Tautan tersalin"); }
    catch { setPesan(link); } // browser menolak akses papan klip: tampilkan tautannya untuk disalin manual
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" onClick={salin} className="rounded-full border border-brand-yellow px-4 py-1.5 text-sm font-semibold text-brand-yellow">Salin tautan refund</button>
      {pesan && <span className="text-sm break-all text-yellow-lime">{pesan}</span>}
    </span>
  );
}

// Dua tindakan untuk pengajuan yang menunggu transfer: tandai selesai (wajib unggah bukti transfer) atau minta
// pemesan memperbaiki data rekening.
export default function RefundAksi({ orderId, nominal }: { orderId: string; nominal: string }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [alasan, setAlasan] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pending, start] = useTransition();

  async function selesai() {
    const bukti = file.current?.files?.[0];
    if (!bukti) { setPesan("Pilih gambar bukti transfernya dulu"); return; }
    if (!window.confirm(`Dana ${nominal} untuk order ${orderId} sudah ditransfer? Bukti dikirim ke email pemesan dan tiketnya tidak berlaku lagi.`)) return;
    setSibuk(true); setPesan("");
    try {
      const body = new FormData();
      body.append("bukti", bukti);
      const res = await fetch(`/kuweraadmin/berkas/refund/${orderId}`, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) router.refresh();
      else setPesan(data.error ?? "Gagal menyimpan, coba lagi");
    } catch {
      setPesan("Koneksi terputus, coba lagi");
    }
    setSibuk(false);
  }
  const perbaikan = () => start(async () => {
    const r = await refundPerbaikanAction(orderId, alasan);
    setPesan(r.error ?? r.ok ?? "");
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-sm font-semibold text-white">Sudah ditransfer</p>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Gambar bukti transfer" className="mt-2 block w-full text-sm text-white/85 file:mr-3 file:rounded-full file:border-0 file:bg-white/15 file:px-4 file:py-1.5 file:text-sm file:text-white" />
        <button type="button" onClick={selesai} disabled={sibuk || pending} className="mt-3 rounded-full bg-brand-yellow px-5 py-2 text-sm font-semibold text-green-deep disabled:opacity-60">
          {sibuk ? "Mengunggah..." : "Unggah bukti dan tandai selesai"}
        </button>
      </div>
      <div>
        <p className="text-sm font-semibold text-white">Rekening bermasalah</p>
        <input value={alasan} onChange={(e) => setAlasan(e.target.value)} maxLength={300} placeholder="Misalnya: nomor rekening tidak ditemukan di BCA" aria-label="Alasan perbaikan" className={`${inputCls} mt-2 py-2 text-sm`} />
        <button type="button" onClick={perbaikan} disabled={sibuk || pending} className="mt-3 rounded-full border border-white/40 px-5 py-2 text-sm text-white/85 disabled:opacity-60">
          {pending ? "Menyimpan..." : "Minta perbaikan"}
        </button>
      </div>
      {pesan && <p className="text-sm text-brand-yellow sm:col-span-2">{pesan}</p>}
    </div>
  );
}
