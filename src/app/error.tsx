"use client";

import { useEffect } from "react";
import NotFoundView from "@/components/NotFoundView";

// Halaman yang error ditampilkan sebagai 404, tanpa detail error ke pengunjung. Errornya tetap tercatat di log.
export default function Error({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => console.error(error), [error]);
  return <NotFoundView />;
}
