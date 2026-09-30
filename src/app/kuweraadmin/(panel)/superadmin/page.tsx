import type { Metadata } from "next";
import { ROLES, ROLE_LABEL, SUPER, requireAdmin, type AdminRole } from "@/lib/admin-auth";
import { dashboardStats, fmtDateTime } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { formatRupiah } from "@/lib/registration";

export const metadata: Metadata = { title: "Superadmin" };
export const dynamic = "force-dynamic";

const LOGIN_ACTIONS = ["login", "login_gagal", "login_terkunci", "logout"];
const LOGIN_LABEL: Record<string, string> = { login: "Berhasil masuk", login_gagal: "Gagal", login_terkunci: "Akun terkunci", logout: "Keluar" };

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-[20px] border border-glass-border bg-card p-5 text-white">
      <p className="text-xs font-semibold tracking-wide text-white/75 uppercase">{label}</p>
      <p className="font-display mt-1 text-4xl">{value}</p>
      {note && <p className="mt-1 text-sm text-white/75">{note}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-[20px] border border-glass-border bg-card p-6">
      <h2 className="font-display text-xl text-white uppercase">{title}</h2>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

// Seperti halaman superadmin Pet Blessing: ringkasan angka, pendaftar per hari, akun per peran, dan log login
// (tanpa persetujuan login; semua login tetap tercatat lengkap dengan perangkat dan IP).
export default async function SuperadminPage() {
  await requireAdmin(SUPER);
  const [s, users, logins, activity] = await Promise.all([
    dashboardStats(),
    prisma.adminUser.findMany({ orderBy: [{ role: "asc" }, { username: "asc" }], select: { id: true, username: true, role: true, lastLoginAt: true, passwordHash: true, lockedUntil: true } }),
    prisma.adminLog.findMany({ where: { action: { in: LOGIN_ACTIONS } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.adminLog.findMany({ where: { action: { notIn: LOGIN_ACTIONS } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const roleOf = (r: string) => ((ROLES as string[]).includes(r) ? ROLE_LABEL[r as AdminRole] : r);
  const maxDaily = Math.max(1, ...s.daily.map((d) => d.count));
  const now = new Date();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl text-white uppercase">Dashboard <span className="text-brand-yellow">superadmin</span></h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Peserta lunas" value={s.paid.toLocaleString("id-ID")} note={`Sisa kuota ${s.remaining.toLocaleString("id-ID")} dari ${s.quotaTotal.toLocaleString("id-ID")}`} />
        <Stat label="Pendapatan terverifikasi" value={formatRupiah(s.revenueTotal)} note="Sesuai nominal di Payment Gateway" />
        <Stat label="Menunggu bayar" value={s.activePending.toLocaleString("id-ID")} note={`${s.expired.toLocaleString("id-ID")} order kedaluwarsa`} />
        <Stat label="Race pack diambil" value={s.collected.toLocaleString("id-ID")} note={`${Math.max(0, s.paid - s.collected).toLocaleString("id-ID")} peserta belum ambil`} />
      </div>

      <Card title="Peserta lunas per hari">
        <div className="flex h-40 items-end gap-2">
          {s.daily.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs text-white/80">{d.count || ""}</span>
              <div className="w-full rounded-t bg-brand-yellow" style={{ height: d.count ? Math.max(4, Math.round((d.count / maxDaily) * 112)) : 0 }} />
              <span className="text-[10px] text-white/65">{d.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Akun dan peran">
          <ul className="divide-y divide-white/10 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="font-semibold text-white">{u.username} <span className="font-normal text-gold">({roleOf(u.role)})</span></span>
                <span className="text-white/70">
                  {!u.passwordHash ? "belum punya kata sandi" : u.lockedUntil && u.lockedUntil > now ? `terkunci sampai ${fmtDateTime(u.lockedUntil)}` : u.lastLoginAt ? `terakhir masuk ${fmtDateTime(u.lastLoginAt)}` : "belum pernah masuk"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-white/65">Superadmin: semua fitur. Admin keuangan: dashboard, peserta, tandai lunas, QR &amp; bukti bayar. Petugas race pack: reg ulang saja.</p>
        </Card>

        <Card title="Aktivitas terbaru">
          {activity.length === 0 ? <p className="text-white/70">Belum ada aktivitas.</p> : (
            // Tinggi daftar mengikuti kartu Akun dan peran di sebelahnya; aktivitas yang lebih panjang digulir.
            <ul className="space-y-1 overflow-y-auto pr-1 text-sm lg:h-0 lg:min-h-full">
              {activity.map((l) => (
                <li key={l.id} className="break-words text-white/85 [overflow-wrap:anywhere]">
                  <span className="text-white/65">{fmtDateTime(l.createdAt)}</span> &middot; <span className="font-semibold text-white">{l.username}</span> {l.action.replace(/_/g, " ")}{l.target ? ` (${l.target})` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Log login">
        {logins.length === 0 ? <p className="text-white/70">Belum ada catatan login.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-white/65 uppercase">
                <tr><th className="py-2 pr-4">Waktu</th><th className="py-2 pr-4">Akun</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Perangkat</th><th className="py-2">IP</th></tr>
              </thead>
              <tbody>
                {logins.map((l) => (
                  <tr key={l.id} className="border-t border-white/10">
                    <td className="py-2 pr-4 text-white/75">{fmtDateTime(l.createdAt)}</td>
                    <td className="py-2 pr-4 font-semibold text-white">{l.username}</td>
                    <td className={`py-2 pr-4 ${l.action === "login" ? "text-yellow-lime" : l.action === "logout" ? "text-white/75" : "text-brand-yellow"}`}>{LOGIN_LABEL[l.action] ?? l.action}</td>
                    <td className="py-2 pr-4 text-white/85">{l.target ?? "-"}</td>
                    <td className="py-2 font-mono text-xs text-white/75">{l.ip ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
