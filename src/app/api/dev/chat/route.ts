import { NextResponse } from "next/server";
import { runAgent } from "@/lib/llm/agent";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Use POST neste endpoint com JSON: { clinicId, userPhone, text }",
    exampleCurl:
      'curl -i -X POST "http://localhost:3000/api/dev/chat" -H "Content-Type: application/json" --data-raw \'{"clinicId":"SEU_CLINIC_ID","userPhone":"5581999999999","text":"quero marcar consulta"}\'',
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clinicId = String(body?.clinicId ?? "");
    const userPhone = String(body?.userPhone ?? "");
    const text = String(body?.text ?? "");

    if (!clinicId || !userPhone || !text) {
      return NextResponse.json(
        { ok: false, error: "Campos obrigatórios: clinicId, userPhone, text" },
        { status: 400 }
      );
    }

    const result = await runAgent({
      clinicId,
      channel: "whatsapp",
      userKey: userPhone,
      userText: text,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("DEV CHAT ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
