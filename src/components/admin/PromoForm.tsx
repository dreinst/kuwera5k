"use client";

import { useActionState, useState, useTransition } from "react";
import { deletePromoAction, savePromoAction, type FormState } from "@/app/kuweraadmin/actions";
import { inputCls } from "@/components/admin/LoginForm";

export type PromoInput = {
  code: string; discountType: string; discountValue: number; quota: number; validFrom: string; validUntil: string; isActive: boolean;
};

// ISO -> nilai input datetime-local dalam WIB.
const toWib = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 16) : "");

// Tanpa promo = formulir tambah. Kode yang sama akan menimpa pengaturan kode itu.
export default function PromoForm({ promo }: { promo?: PromoInput }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePromoAction, null);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kode promo">
          <input name="code" required maxLength={30} defaultValue={promo?.code} readOnly={!!promo} placeholder="KUDAM125" className={`${inputCls} uppercase`} />
        </Field>
        <Field label="Jenis promo">
          <select name="discountType" defaultValue={promo?.discountType ?? "flat"} className={`${inputCls} [&>option]:text-green-deep`}>
            <option value="flat">Harga khusus per tiket (Rp)</option>
            <option value="fixed">Potongan per order (Rp)</option>
            <option value="percent">Diskon persen (%)</option>
          </select>
        </Field>
        <Field label="Harga khusus, potongan, atau persen">
          <input name="discountValue" inputMode="numeric" required defaultValue={promo?.discountValue} placeholder="125000" className={inputCls} />
        </Field>
        <Field label="Kuota (orang)">
          <input name="quota" inputMode="numeric" required defaultValue={promo?.quota} placeholder="100" className={inputCls} />
        </Field>
        <Field label="Mulai berlaku (WIB, kosongkan kalau sekarang)">
          <input type="datetime-local" name="validFrom" defaultValue={toWib(promo?.validFrom ?? null)} className={inputCls} />
        </Field>
        <Field label="Berakhir (WIB)">
          <input type="datetime-local" name="validUntil" required defaultValue={toWib(promo?.validUntil ?? "2026-10-17T16:59:00.000Z")} className={inputCls} />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-white">
        <input type="checkbox" name="isActive" defaultChecked={promo?.isActive ?? true} className="h-5 w-5 accent-brand-yellow" />
        Kode aktif
      </label>
      {state?.error && <p className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">{state.error}</p>}
      {state?.ok && <p className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm text-white">{state.ok}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-brand-yellow px-8 py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
          {pending ? "Menyimpan..." : promo ? "Simpan perubahan" : "Tambah kode"}
        </button>
        {promo && <DeleteButton code={promo.code} />}
      </div>
    </form>
  );
}

// Hapus dua langkah: klik Hapus, lalu konfirmasi Ya, hapus.
function DeleteButton({ code }: { code: string }) {
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, start] = useTransition();
  if (msg?.ok) return <p className="text-sm text-white">{msg.ok}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!ask ? (
        <button type="button" onClick={() => setAsk(true)} className="rounded-full border border-white/40 px-6 py-3 text-sm text-white hover:border-brand-yellow hover:text-brand-yellow">
          Hapus kode
        </button>
      ) : (
        <>
          <span className="text-sm text-white">Hapus {code}?</span>
          <button type="button" disabled={busy} onClick={() => start(async () => setMsg(await deletePromoAction(code)))}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-green-deep disabled:opacity-60">
            {busy ? "Menghapus..." : "Ya, hapus"}
          </button>
          <button type="button" onClick={() => { setAsk(false); setMsg(null); }} className="text-sm text-white/80 underline">Batal</button>
        </>
      )}
      {msg?.error && <p className="w-full text-sm text-brand-yellow">{msg.error}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-white">{label}{children}</label>;
}
