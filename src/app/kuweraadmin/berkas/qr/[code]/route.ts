import { prisma } from "@/lib/db";
import { getAdmin } from "@/lib/admin-auth";
import { download, qrFileName, qrPng } from "@/lib/admin-files";

// QR registrasi ulang satu tiket (PNG), sama dengan yang dikirim bot WA ke pemesan. ?unduh=1 untuk mengunduh.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await getAdmin())) return new Response("Tidak ditemukan", { status: 404 });
  const { code } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { code }, include: { participant: { select: { fullName: true } } } });
  if (!ticket) return new Response("Tidak ditemukan", { status: 404 });
  const inline = !new URL(req.url).searchParams.has("unduh");
  return download(await qrPng(ticket.code), "image/png", qrFileName(ticket.code, ticket.participant?.fullName ?? ""), inline);
}
