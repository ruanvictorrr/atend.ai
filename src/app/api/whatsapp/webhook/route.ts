import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleWhatsAppText } from "@/lib/whatsapp/handler";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0]?.value;
  const metadata = change?.metadata;

  const phoneNumberId = metadata?.phone_number_id as string | undefined;
  const messages = change?.messages;

  if (!phoneNumberId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const channelRow = await prisma.clinicChannel.findFirst({
    where: { channel: "whatsapp", externalId: phoneNumberId, isActive: true },
  });

  if (!channelRow) return NextResponse.json({ ok: true });

  const msg = messages[0];
  const from = msg.from as string;
  const text = msg?.text?.body as string | undefined;

  if (!text) return NextResponse.json({ ok: true });

  await handleWhatsAppText({
    clinicId: channelRow.clinicId,
    phoneNumberId,
    userPhone: from,
    text,
  });

  return NextResponse.json({ ok: true });
}
