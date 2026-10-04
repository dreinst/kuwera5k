"use client";

import Link from "next/link";
import "./globals.css";

// Cadangan kalau layout utama sendiri yang error: tetap tampil sebagai 404 tanpa detail error.
export default function GlobalError() {
  return (
    <html lang="id">
      <body className="flex min-h-screen flex-col items-center justify-center bg-green-deep px-6 text-center">
        <title>Halaman tidak ditemukan</title>
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">404</p>
        <h1 className="mt-2 text-4xl font-bold text-white uppercase">Halaman tidak ditemukan</h1>
        <Link href="/" className="mt-8 rounded-full bg-brand-yellow px-6 py-3 text-sm font-semibold text-green-deep">Ke beranda</Link>
      </body>
    </html>
  );
}
