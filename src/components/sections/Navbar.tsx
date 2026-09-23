"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ArrowCircle from "@/components/ArrowCircle";

const NAV_LINKS = [
  { label: "Beranda", href: "/#hero" },
  { label: "Rute", href: "/#rute" },
  { label: "Info", href: "/#info" },
  { label: "FAQ", href: "/#faq" },
  { label: "Kontak", href: "#kontak" }, // footer ada di semua halaman
];

// Susunan seperti video konsep: menu di kiri, logo di tengah, tombol daftar di kanan.
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 px-6 transition-all duration-300 ${
        scrolled ? "border-b border-glass-border bg-green-deep/80 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center py-3">
        <ul className="col-start-1 row-start-1 hidden items-center gap-7 text-sm text-white/80 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="transition-colors hover:text-brand-yellow">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <Link href="/" aria-label="KUWERA Fun Run, ke beranda" className="col-start-1 row-start-1 justify-self-start md:col-start-2 md:justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
          <img src="/brand/kuwera-logo-light.svg" alt="KUWERA Fun Run" width={2400} height={853} className="h-9 w-auto sm:h-10" />
        </Link>

        <a
          href="/daftar"
          className="col-start-3 row-start-1 inline-flex items-center gap-3 justify-self-end rounded-full bg-brand-yellow py-1.5 pr-1.5 pl-5 text-sm font-semibold text-green-deep transition-transform hover:translate-x-0.5"
        >
          Daftar
          <ArrowCircle small />
        </a>
      </nav>
    </header>
  );
}
