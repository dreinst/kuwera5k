"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Data admin selalu terbaru: muat ulang data halaman tiap beberapa detik dan langsung saat tab dibuka lagi.
// router.refresh() hanya mengambil data server; isian form yang sedang diketik tidak hilang.
export default function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") { router.refresh(); setAt(new Date()); } };
    const t = setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", refresh); };
  }, [router, seconds]);
  return (
    <p className="flex items-center gap-2 text-xs text-white/70">
      <span className="h-2 w-2 animate-pulse rounded-full bg-lime-400" aria-hidden />
      Live{at && `, diperbarui ${at.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })}`}
    </p>
  );
}
