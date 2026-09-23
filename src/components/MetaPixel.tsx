"use client";

import { useEffect } from "react";
import { ensureFbq } from "@/lib/meta-pixel";

// Memuat Meta Pixel dan PageView pertama di setiap halaman. PageView saat pindah halaman dikirim fbevents.js.
export default function MetaPixel() {
  useEffect(() => {
    ensureFbq();
  }, []);
  return null;
}
