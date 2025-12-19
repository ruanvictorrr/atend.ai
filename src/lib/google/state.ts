import crypto from "crypto";

type StatePayload = { staffId: string; ts: number };

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export function signOAuthState(payload: StatePayload) {
  const secret = (process.env.OAUTH_STATE_SECRET ?? "").trim();
  if (!secret) throw new Error("Missing OAUTH_STATE_SECRET");
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string): StatePayload {
  const secret = (process.env.OAUTH_STATE_SECRET ?? "").trim();
  if (!secret) throw new Error("Missing OAUTH_STATE_SECRET");

  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid state");

  const expected = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  if (expected !== sig) throw new Error("Invalid state signature");

  const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as StatePayload;

  // expira em 10 min
  if (Date.now() - payload.ts > 10 * 60 * 1000) throw new Error("State expired");
  return payload;
}
