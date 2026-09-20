import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true, total: true, expiresAt: true, paymentMethod: true, ticket: { select: { code: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
  const expired = order.status === "PENDING" && order.expiresAt && order.expiresAt < new Date();
  return NextResponse.json({
    id: order.id,
    status: expired ? "EXPIRED" : order.status,
    total: order.total,
    expiresAt: order.expiresAt,
    paymentMethod: order.paymentMethod,
    ticketCode: order.ticket?.code ?? null,
  });
}
