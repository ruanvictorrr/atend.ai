import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { clinicId, staffId, serviceId, unitId, startUtc, endUtc } = body;

  if (!clinicId || !staffId || !serviceId || !startUtc || !endUtc) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const start = new Date(startUtc);
  const end = new Date(endUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid startUtc/endUtc" }, { status: 400 });
  }

  const slotKey = `${staffId}:${start.toISOString()}`;

  // ✅ BLOQUEIA se já tem booking ativo nesse slot
  const booking = await prisma.booking.findFirst({
    where: {
      clinicId,
      staffId,
      active: true,
      startUtc: start, // match exato (mesmo ISO)
    },
    select: { id: true },
  });
  if (booking) {
    return NextResponse.json({ ok: false, error: "Conflict: slot already booked" }, { status: 409 });
  }

  // ✅ BLOQUEIA se já tem hold ativo nesse slot
  const hold = await prisma.hold.findFirst({
    where: {
      clinicId,
      staffId,
      active: true,
      startUtc: start,
    },
    select: { id: true },
  });
  if (hold) {
    return NextResponse.json({ ok: false, error: "Conflict: slot already on hold" }, { status: 409 });
  }

  // ✅ cria hold
  const created = await prisma.hold.create({
    data: {
      clinicId,
      staffId,
      serviceId,
      unitId: unitId ?? null,
      startUtc: start,
      endUtc: end,
      active: true,
      expiresAt: addMinutes(new Date(), 5),
      activeSlotKey: slotKey,
    },
  });

  return NextResponse.json({ ok: true, holdId: created.id, activeSlotKey: created.activeSlotKey });
}
