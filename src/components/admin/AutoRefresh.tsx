"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Muat ulang data halaman tiap beberapa detik supaya pendaftar baru langsung terlihat.
export default function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return <p className="text-xs text-white/60">Diperbarui otomatis tiap {seconds} detik</p>;
}
