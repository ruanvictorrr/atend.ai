import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST body: { clinicId, channel: "voice"|"whatsapp", userKey }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clinicId = String(body?.clinicId ?? "");
    const channel = String(body?.channel ?? "");
    const userKey = String(body?.userKey ?? "");

    if (!clinicId || !channel || !userKey) {
      return NextResponse.json(
        { ok: false, error: "Campos obrigatórios: clinicId, channel, userKey" },
        { status: 400 }
      );
    }

    const updated = await prisma.session.updateMany({
      where: { clinicId, channel, userKey },
      data: { stateJson: {} },
    });

    return NextResponse.json({ ok: true, updatedCount: updated.count });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
