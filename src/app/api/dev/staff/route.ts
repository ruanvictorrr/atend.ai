import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clinicId = url.searchParams.get("clinicId");

  const staff = await prisma.staff.findMany({
    where: clinicId ? { clinicId } : undefined,
    select: { id: true, name: true, clinicId: true, unitId: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ok: true, staff });
}
