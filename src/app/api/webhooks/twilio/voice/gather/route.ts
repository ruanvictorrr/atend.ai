import { NextResponse } from "next/server";
import { twiml } from "twilio";
import { prisma } from "@/lib/prisma";
import { runAgent } from "@/lib/llm/agent";

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

// Twilio <Say> fica mais natural sem quebras de linha
function speakify(text: string) {
  return (text || "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const form = await req.formData();

  const to = normalizeE164(String(form.get("To") ?? ""));
  const from = normalizeE164(String(form.get("From") ?? ""));

  const digits = String(form.get("Digits") ?? "").trim();
  const speech = String(form.get("SpeechResult") ?? "").trim();

  // userText: se digitou, preferimos Digits; senão, SpeechResult
  const userText = digits || speech;

  const vr = new twiml.VoiceResponse();

  // Descobrir clínica pelo número Twilio (To)
  const ch = await prisma.clinicChannel.findFirst({
    where: { channel: "voice", externalId: to, isActive: true },
    select: { clinicId: true },
  });

  if (!ch) {
    vr.say("Este número ainda não está configurado para atendimento.");
    vr.hangup();
    return new NextResponse(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // Se não veio nada (silêncio), pergunta de novo
  if (!userText) {
    const gather = vr.gather({
      input: ["speech", "dtmf"],
      action: `${baseUrl(req)}/api/webhooks/twilio/voice/gather`,
      method: "POST",
      timeout: 5,
    });
    gather.say("Não entendi. Diga: quero marcar consulta. Ou digite 1.");
    return new NextResponse(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // Chama o agente (stub) mantendo estado por From (caller)
  const result = await runAgent({
    clinicId: ch.clinicId,
    channel: "voice",
    userKey: from,
    userText,
  });

  const spoken = speakify(result.text);

  // Se parece “finalização”, a gente encerra a ligação
  const isDone =
    /consulta confirmada/i.test(result.text) ||
    /confirmada/i.test(result.text) ||
    /✅/.test(result.text);

  if (isDone) {
    vr.say(spoken);
    vr.hangup();
    return new NextResponse(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // Caso contrário, continua coletando (speech ou dígitos)
  const gather = vr.gather({
    input: ["speech", "dtmf"],
    action: `${baseUrl(req)}/api/webhooks/twilio/voice/gather`,
    method: "POST",
    timeout: 5,
  });

  gather.say(spoken);

  return new NextResponse(vr.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
