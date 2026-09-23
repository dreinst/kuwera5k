"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "Beranda", href: "/#hero" },
  { label: "Rute", href: "/#rute" },
  { label: "Info", href: "/#info" },
  { label: "Kontak", href: "#kontak" }, // footer ada di semua halaman
];

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
        scrolled
          ? "bg-glass backdrop-blur-md border-b border-glass-border"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between py-4">
        <Link href="/" aria-label="KUWERA Fun Run, ke beranda" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
          <img src="/brand/kuwera-logo-light.svg" alt="KUWERA Fun Run" width={2400} height={853} className="h-9 w-auto sm:h-10" />
        </Link>

        <ul className="hidden items-center gap-8 text-sm text-white/80 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="transition-colors hover:text-brand-yellow">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a
            href="/daftar"
            className={`rounded-full bg-brand-yellow px-5 py-2 text-sm font-semibold text-green-deep transition-all duration-300 ${
              scrolled ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
            }`}
          >
            Daftar
          </a>
        </div>
      </nav>
    </header>
  );
}
