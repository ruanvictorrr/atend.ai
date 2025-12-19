import { NextResponse } from "next/server";
import { twiml } from "twilio";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  return process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
}

function normalizeE164(v: string) {
  const s = (v || "").trim();
  if (!s) return "";
  if (s.startsWith("+")) return s;
  return s.startsWith("00") ? `+${s.slice(2)}` : `+${s}`;
}

export async function POST(req: Request) {
  const form = await req.formData();

  const to = normalizeE164(String(form.get("To") ?? ""));
  const from = normalizeE164(String(form.get("From") ?? ""));

  const vr = new twiml.VoiceResponse();

  // Descobrir qual clínica atende esse número (To = número Twilio)
  const ch = await prisma.clinicChannel.findFirst({
    where: { channel: "voice", externalId: to, isActive: true },
    select: { clinicId: true },
  });

  if (!ch) {
    vr.say("Este número ainda não está configurado para atendimento.");
    vr.hangup();
    return new NextResponse(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // 1º turno: pergunta inicial e direciona para o /gather
  const gather = vr.gather({
    input: ["speech", "dtmf"],
    action: `${baseUrl(req)}/api/webhooks/twilio/voice/gather`,
    method: "POST",
    timeout: 5,
  });

  // Nota: falamos uma frase curta e clara
  gather.say(
    "Olá! Sou a secretária virtual. Diga: quero marcar consulta. Ou digite 1 para continuar."
  );

  // (Opcional) você pode usar From pra logging futuro; aqui não precisa.
  void from;

  return new NextResponse(vr.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
