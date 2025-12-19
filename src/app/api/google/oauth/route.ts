import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/lib/google/state";

export const runtime = "nodejs";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });
  if (!code || !state) return NextResponse.json({ ok: false, error: "Missing code/state" }, { status: 400 });

  const payload = verifyOAuthState(state);
  const staffId = payload.staffId;

  const tokenEndpoint = "https://oauth2.googleapis.com/token"; // :contentReference[oaicite:4]{index=4}

  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    grant_type: "authorization_code",
  });

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    return NextResponse.json(
      { ok: false, error: json.error_description ?? JSON.stringify(json) },
      { status: 400 }
    );
  }

  const expiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null;

  const existing = await prisma.staffCalendarConnection.findUnique({ where: { staffId } });

  const refreshToken = json.refresh_token ?? existing?.refreshToken;
  if (!refreshToken) {
    return NextResponse.json(
      { ok: false, error: "No refresh_token returned. Revogue o acesso do app na conta Google e refaça o consent." },
      { status: 400 }
    );
  }

  await prisma.staffCalendarConnection.upsert({
    where: { staffId },
    update: {
      provider: "google",
      calendarId: existing?.calendarId ?? "primary",
      accessToken: json.access_token ?? existing?.accessToken ?? null,
      refreshToken,
      expiresAt: expiresAt ?? existing?.expiresAt ?? null,
      scope: json.scope ?? existing?.scope ?? null,
      tokenType: json.token_type ?? existing?.tokenType ?? null,
    },
    create: {
      staffId,
      provider: "google",
      calendarId: "primary",
      accessToken: json.access_token ?? null,
      refreshToken,
      expiresAt: expiresAt ?? null,
      scope: json.scope ?? null,
      tokenType: json.token_type ?? null,
    },
  });

  return NextResponse.json({ ok: true, staffId, calendarId: "primary" });
}
