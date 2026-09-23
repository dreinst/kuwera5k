"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/peserta", label: "Peserta" },
  { href: "/admin/verifikasi", label: "Verifikasi Midtrans", adminOnly: true },
];

export default function AdminNav({ username, role }: { username: string; role: "admin" | "panitia" }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-glass-border bg-green-deep/85 px-6 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
        <Link href="/admin" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
          <img src="/brand/kuwera-logo-light.svg" alt="KUWERA Fun Run" width={2400} height={853} className="h-8 w-auto" />
          <span className="rounded-md bg-brand-yellow px-2 py-0.5 text-[10px] font-bold tracking-widest text-green-deep uppercase">Admin</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {LINKS.filter((l) => !l.adminOnly || role === "admin").map((l) => {
            const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`rounded-full px-4 py-1.5 transition ${active ? "bg-brand-yellow font-semibold text-green-deep" : "text-white/80 hover:text-brand-yellow"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="flex items-center gap-3 text-sm">
          <span className="text-white/75">{username} <span className="text-gold">({role})</span></span>
          <button type="submit" className="rounded-full border border-glass-border px-4 py-1.5 text-white/85 hover:border-brand-yellow hover:text-brand-yellow">Keluar</button>
        </form>
      </div>
    </header>
  );
}
