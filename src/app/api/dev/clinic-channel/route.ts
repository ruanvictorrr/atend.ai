import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/dev/clinic-channel?clinicId=...
// Lista canais (opcionalmente filtrando por clínica)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clinicId = url.searchParams.get("clinicId") ?? undefined;

  const items = await prisma.clinicChannel.findMany({
    where: clinicId ? { clinicId } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, items });
}

// POST /api/dev/clinic-channel
// Cria canal
// body: { clinicId, channel: "whatsapp"|"voice", externalId, isActive? }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const clinicId = String(body?.clinicId ?? "").trim();
    const channel = String(body?.channel ?? "").trim();
    const externalId = String(body?.externalId ?? "").trim();
    const isActive = body?.isActive === false ? false : true;

    if (!clinicId || !channel || !externalId) {
      return NextResponse.json(
        { ok: false, error: "Campos obrigatórios: clinicId, channel, externalId" },
        { status: 400 }
      );
    }

    if (channel !== "whatsapp" && channel !== "voice") {
      return NextResponse.json(
        { ok: false, error: 'channel deve ser "whatsapp" ou "voice"' },
        { status: 400 }
      );
    }

    // garante que a clínica existe
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      return NextResponse.json({ ok: false, error: "Clinic não encontrada" }, { status: 404 });
    }

    const created = await prisma.clinicChannel.create({
      data: { clinicId, channel, externalId, isActive },
    });

    return NextResponse.json({ ok: true, created });
  } catch (e: any) {
    // erro comum: unique(channel, externalId)
    const msg = e?.message ?? String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// PATCH /api/dev/clinic-channel
// body: { id, isActive }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "").trim();
    const isActive = Boolean(body?.isActive);

    if (!id) {
      return NextResponse.json({ ok: false, error: "Campo obrigatório: id" }, { status: 400 });
    }

    const updated = await prisma.clinicChannel.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
