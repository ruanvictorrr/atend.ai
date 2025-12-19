import { prisma } from "@/lib/prisma";

async function refreshAccessToken(refreshToken: string) {
  const tokenEndpoint = "https://oauth2.googleapis.com/token";

  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`Google refresh error ${res.status}: ${JSON.stringify(json)}`);

  const expiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null;
  return {
    accessToken: json.access_token as string,
    expiresAt,
    scope: (json.scope as string | undefined) ?? null,
    tokenType: (json.token_type as string | undefined) ?? null,
  };
}

export async function getGoogleTokenForStaff(staffId: string) {
  const conn = await prisma.staffCalendarConnection.findUnique({ where: { staffId } });
  if (!conn) return null;

  const needsRefresh =
    !conn.accessToken ||
    !conn.expiresAt ||
    conn.expiresAt.getTime() < Date.now() + 60_000;

  if (!needsRefresh) {
    return {
      accessToken: conn.accessToken!,
      refreshToken: conn.refreshToken,
      expiresAt: conn.expiresAt ?? null,
      calendarId: conn.calendarId,
    };
  }

  const refreshed = await refreshAccessToken(conn.refreshToken);

  await prisma.staffCalendarConnection.update({
    where: { staffId },
    data: {
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt ?? null,
      scope: refreshed.scope,
      tokenType: refreshed.tokenType,
    },
  });

  return {
    accessToken: refreshed.accessToken,
    refreshToken: conn.refreshToken,
    expiresAt: refreshed.expiresAt ?? null,
    calendarId: conn.calendarId,
  };
}

export async function googleFreeBusy(args: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
  timeZone: string;
}) {
  const endpoint = "https://www.googleapis.com/calendar/v3/freeBusy";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: args.timeMin,
      timeMax: args.timeMax,
      timeZone: args.timeZone,
      items: [{ id: args.calendarId }],
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`FreeBusy error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

export async function googleInsertEvent(args: {
  accessToken: string;
  calendarId: string;
  timeZone: string;
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
}) {
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: args.summary,
      description: args.description,
      start: { dateTime: args.startISO, timeZone: args.timeZone },
      end: { dateTime: args.endISO, timeZone: args.timeZone },
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`Insert event error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function pickNextCandidates(now = new Date(), minutesFromNow = [60, 120, 180, 240, 300, 360]) {
  return minutesFromNow.map((m) => new Date(now.getTime() + m * 60_000));
}

export function filterCandidatesByBusy(
  candidates: Date[],
  busy: Array<{ start: string; end: string }>,
  durationMin: number
) {
  const durMs = durationMin * 60_000;
  const busyRanges = busy.map((b) => ({ s: new Date(b.start), e: new Date(b.end) }));
  return candidates.filter((c) => {
    const end = new Date(c.getTime() + durMs);
    return !busyRanges.some((b) => overlaps(c, end, b.s, b.e));
  });
}
