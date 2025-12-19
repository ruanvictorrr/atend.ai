import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function normalizePhone(s: string) {
  // remove espaços, +, parênteses, hífen etc
  const digits = (s || "").replace(/\D/g, "");
  // também permite o formato com + (guardado igual chegou)
  const withPlus = digits ? `+${digits}` : "";
  return { digits, withPlus };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clinicId = url.searchParams.get("clinicId") || "";
    const phoneRaw = url.searchParams.get("phone") || "";

    if (!clinicId || !phoneRaw) {
      return NextResponse.json({ ok: false, error: "clinicId e phone são obrigatórios" }, { status: 400 });
    }

    const { digits, withPlus } = normalizePhone(phoneRaw);

    const booking = await prisma.booking.findFirst({
      where: {
        clinicId,
        OR: [
          { patientPhone: phoneRaw },
          ...(withPlus ? [{ patientPhone: withPlus }] : []),
          ...(digits ? [{ patientPhone: digits }] : []),
        ],
      },
      orderBy: { startUtc: "desc" },
      select: {
        id: true,
        staffId: true,
        startUtc: true,
        endUtc: true,
        patientName: true,
        patientPhone: true,
        googleEventId: true as any,
      },
    });

    return NextResponse.json({
      ok: true,
      booking: booking
        ? {
            ...booking,
            startUtc: booking.startUtc.toISOString(),
            endUtc: booking.endUtc.toISOString(),
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
