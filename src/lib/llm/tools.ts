import { prisma } from "@/lib/prisma";
import {
  getGoogleTokenForStaff,
  googleFreeBusy,
  googleInsertEvent,
  pickNextCandidates,
  filterCandidatesByBusy,
} from "@/lib/google/calendar";

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}

async function expireHolds() {
  await prisma.hold.updateMany({
    where: { active: true, expiresAt: { lt: new Date() } },
    data: { active: false, activeSlotKey: null },
  });
}

export async function toolsDispatch(params: {
  clinicId: string;
  userPhone: string;
  name: string;
  args: any;
}) {
  switch (params.name) {
    case "search_availability":
      return searchAvailability(params.clinicId, params.args);
    case "create_hold":
      return createHold(params.clinicId, params.args);
    case "confirm_booking":
      return confirmBooking(params.clinicId, params.userPhone, params.args);
    default:
      return { ok: false, error: "Unknown tool" };
  }
}

async function searchAvailability(clinicId: string, args: any) {
  await expireHolds();

  const service = await prisma.service.findFirst({
    where: { id: args.serviceId, clinicId },
  });
  if (!service) return { ok: false, error: "Serviço inválido" };

  const totalDurationMin =
    service.durationMin + service.bufferBeforeMin + service.bufferAfterMin;

  const staffRaw = await prisma.staff.findMany({
    where: {
      clinicId,
      services: { some: { serviceId: service.id } },
      ...(args.unitId ? { unitId: args.unitId } : {}),
      ...(args.staffId ? { id: args.staffId } : {}),
    },
    include: { staffCalendarConnection: true },
    take: 10,
  });

  if (staffRaw.length === 0) {
    return { ok: false, error: "Sem profissionais para esse serviço (verifique StaffService)." };
  }

  const staffList = staffRaw.sort((a, b) => {
    const aHas = a.staffCalendarConnection ? 1 : 0;
    const bHas = b.staffCalendarConnection ? 1 : 0;
    return bHas - aHas;
  });

  const tz = process.env.CLINIC_TIMEZONE || "America/Recife";
  const now = new Date();

  const timeMin = now.toISOString();
  const timeMax = addMinutes(now, 24 * 60).toISOString();

  const slots: any[] = [];

  for (const s of staffList) {
    const token = await getGoogleTokenForStaff(s.id);

    let candidates = pickNextCandidates(now);

    if (token) {
      const fb = await googleFreeBusy({
        accessToken: token.accessToken,
        calendarId: token.calendarId,
        timeMin,
        timeMax,
        timeZone: tz,
      });

      const busy = fb?.calendars?.[token.calendarId]?.busy ?? [];
      candidates = filterCandidatesByBusy(candidates, busy, totalDurationMin);
    }

    for (const start of candidates) {
      const end = addMinutes(start, totalDurationMin);
      const slotKey = `${s.id}:${start.toISOString()}`;

      const booking = await prisma.booking.findFirst({
        where: { clinicId, staffId: s.id, active: true, activeSlotKey: slotKey },
        select: { id: true },
      });

      const hold = await prisma.hold.findFirst({
        where: { clinicId, staffId: s.id, active: true, activeSlotKey: slotKey },
        select: { id: true },
      });

      if (!booking && !hold) {
        slots.push({
          staffId: s.id,
          staffName: s.name,
          serviceId: service.id,
          unitId: s.unitId ?? null,
          startUtc: start.toISOString(),
          endUtc: end.toISOString(),
        });
      }

      if (slots.length >= 3) break;
    }

    if (slots.length >= 3) break;
  }

  return { ok: true, slots };
}

async function createHold(clinicId: string, args: any) {
  await expireHolds();

  const startUtc = new Date(args.startUtc);
  const endUtc = new Date(args.endUtc);

  if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    return { ok: false, error: "Horário inválido." };
  }

  const activeSlotKey = `${args.staffId}:${startUtc.toISOString()}`;

  const bookingExists = await prisma.booking.findFirst({
    where: { clinicId, staffId: args.staffId, active: true, startUtc },
    select: { id: true },
  });
  if (bookingExists) return { ok: false, error: "Esse horário já está reservado." };

  const holdExists = await prisma.hold.findFirst({
    where: { clinicId, staffId: args.staffId, active: true, startUtc },
    select: { id: true },
  });
  if (holdExists) return { ok: false, error: "Esse horário já está em reserva temporária." };

  try {
    const hold = await prisma.hold.create({
      data: {
        clinicId,
        staffId: args.staffId,
        serviceId: args.serviceId,
        unitId: args.unitId ?? null,
        startUtc,
        endUtc,
        active: true,
        expiresAt: addMinutes(new Date(), 5),
        activeSlotKey,
      },
    });

    return { ok: true, holdId: hold.id, expiresAt: hold.expiresAt.toISOString() };
  } catch {
    return { ok: false, error: "Esse horário acabou de ser reservado." };
  }
}

async function confirmBooking(clinicId: string, userPhone: string, args: any) {
  await expireHolds();

  const hold = await prisma.hold.findFirst({
    where: { id: args.holdId, clinicId, active: true },
  });
  if (!hold) return { ok: false, error: "Esse horário expirou." };

  const existing = await prisma.booking.findUnique({
    where: { idempotencyKey: args.idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      bookingId: existing.id,
      startUtc: existing.startUtc.toISOString(),
      googleEventId: (existing as any).googleEventId ?? null,
    };
  }

  const service = await prisma.service.findUnique({ where: { id: hold.serviceId } });
  if (!service) return { ok: false, error: "Serviço não encontrado para esse hold." };

  const staff = await prisma.staff.findUnique({ where: { id: hold.staffId } });
  if (!staff) return { ok: false, error: "Profissional não encontrado para esse hold." };

  const tz = process.env.CLINIC_TIMEZONE || "America/Recife";
  const activeSlotKey = `${hold.staffId}:${hold.startUtc.toISOString()}`;

  const token = await getGoogleTokenForStaff(hold.staffId);
  if (!token) return { ok: false, error: "Esse profissional ainda não conectou o Google Calendar." };

  let googleEventId: string;

  try {
    const ev = await googleInsertEvent({
      accessToken: token.accessToken,
      calendarId: token.calendarId,
      timeZone: tz,
      summary: `${service.name} - ${args.patientName}`,
      description: `Paciente: ${args.patientName}\nTelefone: ${userPhone}\nStaff: ${staff.name}`,
      startISO: hold.startUtc.toISOString(),
      endISO: hold.endUtc.toISOString(),
    });

    googleEventId = ev?.id;
    if (!googleEventId) return { ok: false, error: "Evento criado mas sem ID retornado." };
  } catch (e: any) {
    console.error("[confirm_booking] google insert failed:", e?.message ?? e);
    return { ok: false, error: "Falha ao criar evento no Google Calendar." };
  }

  const booking = await prisma.booking.create({
    data: {
      clinicId,
      staffId: hold.staffId,
      serviceId: hold.serviceId,
      unitId: hold.unitId,
      patientName: args.patientName,
      patientPhone: userPhone,
      startUtc: hold.startUtc,
      endUtc: hold.endUtc,
      status: "confirmed",
      active: true,
      idempotencyKey: args.idempotencyKey,
      activeSlotKey,
      googleEventId,
    } as any,
  });

  await prisma.hold.update({
    where: { id: hold.id },
    data: { active: false, activeSlotKey: null },
  });

  return {
    ok: true,
    bookingId: booking.id,
    startUtc: booking.startUtc.toISOString(),
    googleEventId: (booking as any).googleEventId ?? null,
  };
}

// ✅ garantir também default export
export default toolsDispatch;
