"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/admin/actions";
import Turnstile from "@/components/registration/Turnstile";

const noop = () => {};

export default function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, null);
  return (
    <form action={action} className="mt-6 grid gap-4">
      <label className="grid gap-2 text-sm font-medium text-white">
        Username
        <input name="username" autoComplete="username" required className={inputCls} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-white">
        Kata sandi
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </label>
      <Turnstile onToken={noop} resetSignal={0} />
      {state?.error && <p className="rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">{state.error}</p>}
      <button type="submit" disabled={pending} className="mt-2 rounded-full bg-brand-yellow py-3 text-sm font-semibold text-green-deep disabled:opacity-60">
        {pending ? "Memeriksa..." : "Masuk"}
      </button>
    </form>
  );
}

export const inputCls = "w-full rounded-xl border border-glass-border bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-brand-yellow focus:outline-none";
