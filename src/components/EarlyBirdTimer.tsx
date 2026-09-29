"use client";

import { useNow } from "@/lib/use-now";

// Sisa waktu harga promo (jam:menit:detik), dipakai kartu ajakan di hero.
export default function EarlyBirdTimer({ to }: { to: string }) {
  const now = useNow();
  const left = now === null ? null : Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const parts = left === null ? ["--", "--", "--"] : [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60].map((n) => String(n).padStart(2, "0"));
  return (
    <p role="timer" className="font-display text-5xl leading-none text-brand-yellow tabular-nums">
      {left === 0 ? "Berakhir" : parts.join(":")}
    </p>
  );
}
