"use client";

import { useState, useTransition } from "react";
import { setTestOrderAction } from "@/app/kuweraadmin/actions";

export default function TestOrderToggle({ orderId, isTest }: { orderId: string; isTest: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    const r = await setTestOrderAction(orderId, !isTest);
    setMessage(r.error ?? r.ok ?? "");
  });
  return (
    <div>
      <p className="text-sm text-white/80">
        {isTest
          ? "Order ini data uji: tetap tersimpan, tetapi tidak dihitung di statistik, kuota, pendapatan, dan angka di website."
          : "Tandai sebagai data uji kalau order ini hanya untuk mencoba sistem. Datanya tidak dihapus."}
      </p>
      <button type="button" onClick={run} disabled={pending} className="mt-3 rounded-full border border-brand-yellow px-5 py-2 text-sm font-semibold text-brand-yellow disabled:opacity-60">
        {isTest ? "Jadikan data asli" : "Tandai sebagai data uji"}
      </button>
      {message && <p className="mt-2 text-sm text-brand-yellow">{message}</p>}
    </div>
  );
}
