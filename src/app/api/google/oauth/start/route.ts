import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signOAuthState } from "@/lib/google/state";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const staffId = url.searchParams.get("staffId");
  if (!staffId) return NextResponse.json({ ok: false, error: "Missing staffId" }, { status: 400 });

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ ok: false, error: "Staff not found" }, { status: 404 });

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  const state = signOAuthState({ staffId, ts: Date.now() });

  // Escopos suficientes p/ FreeBusy e criar evento
  const scope = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });

  // auth endpoint (web server flow) :contentReference[oaicite:3]{index=3}
  const authBase = "https://accounts.google.com/o/oauth2/v2/auth";
  return NextResponse.redirect(`${authBase}?${params.toString()}`);
}
