"use client";

import { useState, useTransition } from "react";
import { racepackAction } from "@/app/admin/actions";

export default function RacepackButton({ orderId, collected, canUndo }: { orderId: string; collected: boolean; canUndo: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const run = (undo: boolean) => start(async () => {
    const r = await racepackAction(orderId, undo);
    setMessage(r.error ?? r.ok ?? "");
  });
  return (
    <div>
      {!collected ? (
        <button type="button" onClick={() => run(false)} disabled={pending} className="rounded-full bg-brand-yellow px-5 py-2 text-sm font-semibold text-green-deep disabled:opacity-60">
          Tandai race pack sudah diambil
        </button>
      ) : canUndo ? (
        <button type="button" onClick={() => run(true)} disabled={pending} className="rounded-full border border-white/40 px-5 py-2 text-sm text-white/85 disabled:opacity-60">
          Batalkan tanda ambil
        </button>
      ) : null}
      {message && <p className="mt-2 text-sm text-brand-yellow">{message}</p>}
    </div>
  );
}
