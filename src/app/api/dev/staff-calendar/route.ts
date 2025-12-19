import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const staffId = url.searchParams.get("staffId");
  if (!staffId) return NextResponse.json({ ok: false, error: "Missing staffId" }, { status: 400 });

  const conn = await prisma.staffCalendarConnection.findUnique({
    where: { staffId },
    select: {
      staffId: true,
      provider: true,
      calendarId: true,
      expiresAt: true,
      refreshToken: true,
      accessToken: true,
    },
  });

  if (!conn) return NextResponse.json({ ok: true, connected: false });

  return NextResponse.json({
    ok: true,
    connected: true,
    provider: conn.provider,
    calendarId: conn.calendarId,
    hasRefreshToken: !!conn.refreshToken,
    hasAccessToken: !!conn.accessToken,
    expiresAt: conn.expiresAt,
  });
}
