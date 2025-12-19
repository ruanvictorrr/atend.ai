import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgent } from "@/lib/llm/agent";

export const runtime = "nodejs";

async function sendWhatsAppText(phoneNumberId: string, to: string, text: string) {
  const token = (process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim();
  if (!token) throw new Error("Missing WHATSAPP_ACCESS_TOKEN");

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  const j = await res.json();
  if (!res.ok) throw new Error(`WA send failed ${res.status}: ${JSON.stringify(j)}`);
  return j;
}

// Verificação do webhook (Meta)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verify = (process.env.WHATSAPP_VERIFY_TOKEN ?? "").trim();
  if (mode === "subscribe" && token && verify && token === verify) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // estrutura típica: entry[0].changes[0].value
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id as string | undefined;
    const msg = value?.messages?.[0];
    const from = msg?.from as string | undefined; // wa_id
    const text = msg?.text?.body as string | undefined;

    if (!phoneNumberId || !from || !text) {
      return NextResponse.json({ ok: true }); // ignora eventos não-texto
    }

    const ch = await prisma.clinicChannel.findFirst({
      where: { channel: "whatsapp", externalId: phoneNumberId, isActive: true },
      select: { clinicId: true },
    });

    if (!ch) return NextResponse.json({ ok: true });

    // opcional: log
    await prisma.messageLog.create({
      data: {
        clinicId: ch.clinicId,
        channel: "whatsapp",
        userKey: from,
        direction: "in",
        text,
        rawJson: body,
      },
    });

    const out = await runAgent({
      clinicId: ch.clinicId,
      channel: "whatsapp",
      userKey: from,
      userText: text,
    });

    await sendWhatsAppText(phoneNumberId, from, out.text);

    await prisma.messageLog.create({
      data: {
        clinicId: ch.clinicId,
        channel: "whatsapp",
        userKey: from,
        direction: "out",
        text: out.text,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("WHATSAPP WEBHOOK ERROR:", e?.message ?? e);
    return NextResponse.json({ ok: true }); // não derruba o webhook
  }
}
