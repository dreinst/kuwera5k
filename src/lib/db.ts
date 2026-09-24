import tls from "node:tls";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// TLS ke Postgres: kalau DB_SSL_CA berisi sertifikat CA (PEM), koneksi dienkripsi dan sertifikat server wajib
// ditandatangani CA itu. Sertifikat buatan Coolify memuat nama resource database, bukan IP publik server, jadi
// saat terhubung lewat IP (dari Vercel) nama yang dicocokkan diambil dari DB_SSL_SERVERNAME; di dalam VPS
// host-nya memang nama resource itu dan pengecekan biasa berlaku. DATABASE_URL tidak boleh memuat sslmode:
// parameter di URL mengalahkan pengaturan ssl di sini. Tanpa DB_SSL_CA koneksi tetap seperti URL-nya.
export function dbSsl() {
  const ca = process.env.DB_SSL_CA?.replace(/\\n/g, "\n").trim();
  if (!ca) return undefined;
  const name = process.env.DB_SSL_SERVERNAME;
  return {
    ca,
    rejectUnauthorized: true,
    ...(name ? { checkServerIdentity: (_host: string, cert: tls.PeerCertificate) => tls.checkServerIdentity(name, cert) } : {}),
  };
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: dbSsl(),
    // Banyak instance serverless berbagi max_connections Postgres (100), jadi pool per instance dibuat kecil.
    max: 5,
    // Batas tunggu koneksi dari pool supaya request tidak menggantung saat pool penuh.
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
