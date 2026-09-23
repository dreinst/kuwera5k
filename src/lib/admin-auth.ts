import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

// Autentikasi halaman admin. Setiap halaman, server action, dan route handler admin memanggil
// requireAdmin() sendiri (layout tidak cukup, lihat panduan autentikasi Next 16).

export type AdminRole = "admin" | "panitia";
export type AdminSession = { id: string; username: string; role: AdminRole };

const COOKIE = "kw_admin";
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

// Hash palsu supaya waktu respons sama untuk username yang tidak ada.
const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export async function verifyPassword(password: string, stored: string | null) {
  const [scheme, saltB64, hashB64] = (stored ?? DUMMY_HASH).split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return stored !== null && timingSafeEqual(actual, expected);
}

// Kunci penanda tangan sesi disimpan di tabel Setting (dibuat sekali), jadi tidak perlu env tambahan.
// Menghapus baris "adminAuth" = semua sesi admin keluar.
let cachedSecret: string | null = null;
async function sessionSecret() {
  if (cachedSecret) return cachedSecret;
  const row = await prisma.setting.findUnique({ where: { key: "adminAuth" } });
  let secret = (row?.value as { secret?: string } | null)?.secret;
  if (!secret) {
    const fresh = randomBytes(32).toString("base64url");
    await prisma.setting.create({ data: { key: "adminAuth", value: { secret: fresh } } }).catch(() => null);
    const again = await prisma.setting.findUnique({ where: { key: "adminAuth" } });
    secret = (again?.value as { secret?: string } | null)?.secret ?? fresh;
  }
  cachedSecret = secret;
  return secret;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export async function startSession(user: { id: string; sessionVersion: number }) {
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  const payload = b64(JSON.stringify({ u: user.id, v: user.sessionVersion, exp }));
  const token = `${payload}.${sign(payload, await sessionSecret())}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/admin", maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

// Sesi yang sah atau null. Tanda tangan, masa berlaku, dan versi sesi di database semuanya dicek.
export async function getAdmin(): Promise<AdminSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, await sessionSecret()));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let data: { u: string; v: number; exp: number };
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
  if (!data.exp || data.exp < Date.now()) return null;
  const user = await prisma.adminUser.findUnique({ where: { id: data.u } });
  if (!user || !user.passwordHash || user.sessionVersion !== data.v) return null;
  return { id: user.id, username: user.username, role: user.role === "admin" ? "admin" : "panitia" };
}

// Untuk halaman: belum login dialihkan ke /admin/login. `role: "admin"` membatasi fitur khusus admin.
export async function requireAdmin(opts: { role?: "admin" } = {}) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (opts.role === "admin" && admin.role !== "admin") redirect("/admin");
  return admin;
}

export async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

export async function logAdmin(username: string, action: string, target?: string | null) {
  await prisma.adminLog.create({ data: { username, action, target: target ?? null, ip: await clientIp() } }).catch(() => null);
}

// Login: hitungan gagal per akun, dikunci sementara setelah beberapa kali salah.
export async function attemptLogin(username: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const generic = "Username atau kata sandi salah";
  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await logAdmin(username, "login_terkunci");
    return { ok: false, message: `Terlalu banyak percobaan. Coba lagi setelah ${LOCK_MINUTES} menit.` };
  }
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !valid) {
    if (user) {
      const failed = user.failedLogins + 1;
      await prisma.adminUser.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed },
      });
    }
    await logAdmin(username || "(kosong)", "login_gagal");
    return { ok: false, message: generic };
  }
  await prisma.adminUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await startSession(user);
  await logAdmin(user.username, "login");
  return { ok: true };
}
