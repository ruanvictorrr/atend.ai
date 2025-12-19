import { prisma } from "@/lib/prisma";
import { runAgent } from "@/lib/llm/agent";
import { sendWhatsAppText } from "./sendText";

export async function handleWhatsAppText(params: {
  clinicId: string;
  phoneNumberId: string;
  userPhone: string;
  text: string;
}) {
  await prisma.messageLog.create({
    data: {
      clinicId: params.clinicId,
      channel: "whatsapp",
      userKey: params.userPhone,
      direction: "in",
      text: params.text,
    },
  });

  const result = await runAgent({
    clinicId: params.clinicId,
    userPhone: params.userPhone,
    userText: params.text,
  });

  if (result.type === "say") {
    await sendWhatsAppText({
      phoneNumberId: params.phoneNumberId,
      to: params.userPhone,
      text: result.text,
    });

    await prisma.messageLog.create({
      data: {
        clinicId: params.clinicId,
        channel: "whatsapp",
        userKey: params.userPhone,
        direction: "out",
        text: result.text,
      },
    });
  }
}