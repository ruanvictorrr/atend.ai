import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const clinics = await prisma.clinic.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ok: true, clinics });
}
