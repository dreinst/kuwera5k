// Buat akun admin baru atau reset kata sandinya: npm run admin:user -- <username> <admin|panitia>
// Mencetak link sekali pakai (berlaku 24 jam) untuk mengatur kata sandi sendiri, jadi kata sandi
// tidak pernah lewat chat. Reset juga mengeluarkan semua sesi lama akun itu.
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const [username = "", role = "panitia"] = process.argv.slice(2);
if (!/^[a-z0-9._-]{3,32}$/.test(username) || !["admin", "panitia"].includes(role)) {
  console.error("Pakai: npm run admin:user -- <username huruf kecil> <admin|panitia>");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const token = randomBytes(32).toString("base64url");
const data = {
  role, passwordHash: null, failedLogins: 0, lockedUntil: null,
  setupTokenHash: createHash("sha256").update(token).digest("hex"),
  setupExpires: new Date(Date.now() + 24 * 3600_000),
};
const existing = await prisma.adminUser.findUnique({ where: { username } });
if (existing) await prisma.adminUser.update({ where: { username }, data: { ...data, sessionVersion: { increment: 1 } } });
else await prisma.adminUser.create({ data: { username, ...data } });
await prisma.$disconnect();
const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://kuwera5k.vercel.app").replace(/\/$/, "");
console.log(`${existing ? "Akun direset" : "Akun dibuat"}: ${username} (${role})`);
console.log(`Link atur kata sandi (sekali pakai, berlaku 24 jam):\n${site}/admin/setup?token=${token}`);
