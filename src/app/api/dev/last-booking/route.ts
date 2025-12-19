import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clinicId = url.searchParams.get("clinicId");
  const phone = url.searchParams.get("phone");
  if (!clinicId || !phone) {
    return NextResponse.json({ ok: false, error: "Missing clinicId/phone" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { clinicId, patientPhone: phone },
    orderBy: { createdAt: "desc" },
    select: {
        id: true,
        staffId: true,
        serviceId: true,
        startUtc: true,
        endUtc: true,
        googleEventId: true,
        patientName: true,
        },
  });

  return NextResponse.json({ ok: true, booking });
}