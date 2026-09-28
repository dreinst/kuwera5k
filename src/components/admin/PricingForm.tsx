"use client";

import { useActionState } from "react";
import { savePricingAction, type FormState } from "@/app/kuweraadmin/actions";
import { inputCls } from "@/components/admin/LoginForm";
import type { Pricing } from "@/lib/pricing";

// ISO -> nilai input datetime-local dalam WIB.
const toWib = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 16) : "");

export default function PricingForm({ pricing }: { pricing: Pricing }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePricingAction, null);
  return (
    <form action={action} className="grid gap-8">
      <fieldset className="grid gap-4">
        <legend className="font-display text-xl text-white uppercase">Pendaftaran</legend>
        <Toggle name="open" label="Pendaftaran dibuka" defaultChecked={pricing.open} />
        <Field label="Buka otomatis pada (WIB, kosongkan kalau langsung buka)">
          <input type="datetime-local" name="openAt" defaultValue={toWib(pricing.openAt)} className={inputCls} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="font-display text-xl text-white uppercase">Harga promo</legend>
        <Toggle name="promoEnabled" label="Harga promo aktif" defaultChecked={pricing.promo.enabled} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama promo">
            <input name="promoLabel" required maxLength={40} defaultValue={pricing.promo.label} className={inputCls} />
          </Field>
          <Field label="Harga promo (Rp)">
            <input name="promoPrice" inputMode="numeric" required defaultValue={pricing.promo.price} className={inputCls} />
          </Field>
          <Field label="Mulai (WIB, kosongkan kalau langsung)">
            <input type="datetime-local" name="promoStart" defaultValue={toWib(pricing.promo.start)} className={inputCls} />
          </Field>
          <Field label="Selesai (WIB, kosongkan kalau sampai dimatikan)">
            <input type="datetime-local" name="promoEnd" defaultValue={toWib(pricing.promo.end)} className={inputCls} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="font-display text-xl text-white uppercase">Harga normal</legend>
        <p className="text-sm text-white/70">Berlaku saat harga promo mati atau di luar jadwalnya.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama harga">
            <input name="regularLabel" required maxLength={40} defaultValue={pricing.regular.label} className={inputCls} />
          </Field>
          <Field label="Harga (Rp)">
            <input name="regularPrice" inputMode="numeric" required defaultValue={pricing.regular.price} className={inputCls} />
          </Field>
        </div>
      </fieldset>

      {state?.error && <p className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">{state.error}</p>}
      {state?.ok && <p className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm text-white">{state.ok}</p>}
      <button type="submit" disabled={pending} className="justify-self-start rounded-full bg-brand-yellow px-8 py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium text-white">{label}{children}</label>;
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 text-white">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-5 w-5 accent-brand-yellow" />
      {label}
    </label>
  );
}
