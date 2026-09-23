"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ensureFbq } from "@/lib/meta-pixel";

// Memuat Meta Pixel dan PageView pertama di setiap halaman. PageView saat pindah halaman dikirim fbevents.js.
// Halaman admin tidak dilacak Pixel.
export default function MetaPixel() {
  const isAdmin = (usePathname() ?? "").startsWith("/admin");
  useEffect(() => {
    if (!isAdmin) ensureFbq();
  }, [isAdmin]);
  return null;
}
