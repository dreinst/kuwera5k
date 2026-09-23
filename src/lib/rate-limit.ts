import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// Pembatas laju sederhana di Postgres (aman untuk serverless: hitungan dibagi semua instance).
// Batasnya longgar karena banyak pengguna HP berbagi satu IP (CGNAT); tujuannya menghentikan skrip,
// bukan peserta sungguhan. Kalau database gagal, permintaan tetap dilayani (fail-open).
export async function clientIpFromHeaders() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function rateLimit(bucket: string, limit: number, windowSeconds: number, ip?: string): Promise<boolean> {
  const key = `${bucket}:${ip ?? (await clientIpFromHeaders())}`;
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, now(), 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::float8) THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::float8) THEN now() ELSE "RateLimit"."windowStart" END
      RETURNING "count"`;
    return (rows[0]?.count ?? 0) <= limit;
  } catch {
    return true;
  }
}

export const tooMany = () =>
  Response.json({ error: "Terlalu banyak permintaan dari jaringan ini. Tunggu beberapa menit lalu coba lagi." }, { status: 429 });
