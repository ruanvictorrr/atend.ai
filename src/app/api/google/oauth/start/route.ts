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

  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI ?? "").trim();
  if (!clientId) return NextResponse.json({ ok: false, error: "Missing GOOGLE_CLIENT_ID" }, { status: 500 });
  if (!redirectUri) return NextResponse.json({ ok: false, error: "Missing GOOGLE_REDIRECT_URI" }, { status: 500 });

  const state = signOAuthState({ staffId, ts: Date.now() });

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

  const authBase = "https://accounts.google.com/o/oauth2/v2/auth";
  return NextResponse.redirect(`${authBase}?${params.toString()}`);
}
