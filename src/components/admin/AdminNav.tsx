"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/kuweraadmin/actions";
import { FINANCE, ROLE_LABEL, SCAN, SUPER, homeFor, type AdminRole } from "@/lib/admin-roles";

// Menu mengikuti peran; halaman yang tidak boleh dibuka juga ditolak di servernya masing-masing.
const LINKS = [
  { href: "/kuweraadmin", label: "Dashboard", roles: FINANCE },
  { href: "/kuweraadmin/peserta", label: "Peserta", roles: FINANCE },
  { href: "/kuweraadmin/qr", label: "QR & Bukti", roles: FINANCE },
  { href: "/kuweraadmin/regulang", label: "Reg ulang", roles: SCAN },
  { href: "/kuweraadmin/superadmin", label: "Superadmin", roles: SUPER },
  { href: "/kuweraadmin/kudam", label: "Anggota Kudam", roles: SUPER },
  { href: "/kuweraadmin/harga", label: "Harga", roles: SUPER },
  { href: "/kuweraadmin/penarikan", label: "Penarikan GoPay", roles: SUPER },
  { href: "/kuweraadmin/promo", label: "Kode promo", roles: SUPER },
  { href: "/kuweraadmin/verifikasi", label: "Verifikasi Midtrans", roles: SUPER },
];

export default function AdminNav({ username, role }: { username: string; role: AdminRole }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-glass-border bg-green-deep/85 px-6 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
        <Link href={homeFor(role)} className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statis */}
          <img src="/brand/kuwera-logo-light.svg" alt="KUWERA Fun Run" width={2400} height={853} className="h-8 w-auto" />
          <span className="rounded-md bg-brand-yellow px-2 py-0.5 text-[10px] font-bold tracking-widest text-green-deep uppercase">Admin</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {LINKS.filter((l) => l.roles.includes(role)).map((l) => {
            const active = l.href === "/kuweraadmin" ? path === "/kuweraadmin" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`rounded-full px-4 py-1.5 transition ${active ? "bg-brand-yellow font-semibold text-green-deep" : "text-white/80 hover:text-brand-yellow"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="flex items-center gap-3 text-sm">
          <span className="text-white/75">{username} <span className="text-gold">({ROLE_LABEL[role]})</span></span>
          <button type="submit" className="rounded-full border border-glass-border px-4 py-1.5 text-white/85 hover:border-brand-yellow hover:text-brand-yellow">Keluar</button>
        </form>
      </div>
    </header>
  );
}
