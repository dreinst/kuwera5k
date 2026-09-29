// Peran akun admin, dipakai di server dan di komponen browser (menu).
// superadmin: pengaturan dan keuangan. admin: keuangan (tandai lunas, bukti bayar, data peserta).
// petugas: reg ulang race pack saja; halaman reg ulang terpisah dan tidak dipakai superadmin.
export type AdminRole = "superadmin" | "admin" | "petugas";
export const ROLES: AdminRole[] = ["superadmin", "admin", "petugas"];
export const ROLE_LABEL: Record<AdminRole, string> = { superadmin: "Superadmin", admin: "Admin keuangan", petugas: "Petugas race pack" };
export const FINANCE: AdminRole[] = ["superadmin", "admin"];
export const SCAN: AdminRole[] = ["petugas"];
export const SUPER: AdminRole[] = ["superadmin"];
export const allowed = (role: AdminRole, roles: AdminRole[]) => roles.includes(role);
// Halaman awal tiap peran: petugas langsung ke reg ulang.
export const homeFor = (role: AdminRole) => (role === "petugas" ? "/kuweraadmin/regulang" : "/kuweraadmin");
