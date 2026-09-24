import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Perubahan skema (prisma db push) memakai DATABASE_URL_MIGRASI: akun pemilik skema, TLS lewat parameter URL
// (sslmode=require&sslaccept=accept_invalid_certs). Aplikasi sendiri memakai DATABASE_URL (akun terbatas).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL_MIGRASI || env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
  },
});
