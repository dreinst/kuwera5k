"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setupPasswordAction, type FormState } from "@/app/admin/actions";
import { inputCls } from "@/components/admin/LoginForm";

export default function SetupForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setupPasswordAction, null);
  if (state?.ok) {
    return (
      <div className="mt-6">
        <p className="text-white/85">{state.ok}</p>
        <Link href="/admin/login" className="mt-5 inline-block rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep">Ke halaman masuk</Link>
      </div>
    );
  }
  return (
    <form action={action} className="mt-6 grid gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="grid gap-2 text-sm font-medium text-white">
        Kata sandi baru
        <input name="password" type="password" autoComplete="new-password" minLength={10} required className={inputCls} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-white">
        Ulangi kata sandi
        <input name="confirm" type="password" autoComplete="new-password" minLength={10} required className={inputCls} />
      </label>
      <p className="text-xs text-white/70">Minimal 10 karakter. Link ini hanya bisa dipakai sekali.</p>
      {state?.error && <p className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">{state.error}</p>}
      <button type="submit" disabled={pending} className="mt-2 rounded-full bg-brand-yellow py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
        {pending ? "Menyimpan..." : "Simpan kata sandi"}
      </button>
    </form>
  );
}
