import { prisma } from "@/lib/prisma";
import { llmChat } from "./client";
import * as Tools from "./tools";

// ✅ Resolve toolsDispatch de forma robusta (named ou default)
const toolsDispatchFn: any = (Tools as any).toolsDispatch ?? (Tools as any).default;

if (typeof toolsDispatchFn !== "function") {
  throw new Error(`toolsDispatch export inválido. keys=${Object.keys(Tools).join(",")}`);
}

function tz() {
  return process.env.CLINIC_TIMEZONE || "America/Recife";
}

// Ex: "19/12/2025 03:09"
function formatLocalShort(isoUtc: string) {
  const d = new Date(isoUtc);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz(),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function toIntPart(parts: Intl.DateTimeFormatPart[], type: string) {
  const v = parts.find((p) => p.type === type)?.value ?? "";
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function getLocalHM(isoUtc: string) {
  const d = new Date(isoUtc);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz(),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  return {
    hour24: toIntPart(parts, "hour"),
    minute: toIntPart(parts, "minute"),
  };
}

function numberToWordsPt(n: number): string {
  const units = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta"];

  if (n < 0) return String(n);
  if (n < 10) return units[n];
  if (n < 20) return teens[n - 10];
  if (n < 60) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? tens[t] : `${tens[t]} e ${units[u]}`;
  }
  return String(n);
}

function periodLabel(hour24: number) {
  // Ajuste se você quiser: 3h pode ser "da manhã", mas o mais natural é "da madrugada"
  if (hour24 >= 0 && hour24 <= 5) return "da madrugada";
  if (hour24 >= 6 && hour24 <= 11) return "da manhã";
  if (hour24 >= 12 && hour24 <= 17) return "da tarde";
  return "da noite";
}

function hourToWords(hour24: number): { hour12: number; words: string; period: string; special?: "meia-noite" | "meio-dia" } {
  const period = periodLabel(hour24);

  // especiais
  if (hour24 === 0) return { hour12: 12, words: "meia-noite", period, special: "meia-noite" };
  if (hour24 === 12) return { hour12: 12, words: "meio-dia", period, special: "meio-dia" };

  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  // horas em pt costumam usar feminino: 1 = uma, 2 = duas
  if (hour12 === 1) return { hour12, words: "uma", period };
  if (hour12 === 2) return { hour12, words: "duas", period };

  return { hour12, words: numberToWordsPt(hour12), period };
}

// Ex: "sexta-feira, 19 de dezembro de 2025 às três e nove da madrugada"
function formatLocalSpokenWords(isoUtc: string) {
  const d = new Date(isoUtc);

  const datePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz(),
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);

  const { hour24, minute } = getLocalHM(isoUtc);
  const h = hourToWords(hour24);

  // meia-noite / meio-dia “em ponto”
  if (h.special && minute === 0) {
    // "às meia-noite" / "ao meio-dia"
    const prefix = h.special === "meio-dia" ? "ao" : "às";
    return `${datePart} ${prefix} ${h.words}`;
  }

  // geral
  const prefix = "às";
  const minWords =
    minute === 0 ? "em ponto" : `e ${numberToWordsPt(minute)}`;

  return `${datePart} ${prefix} ${h.words} ${minWords} ${h.period}`.replace(/\s+/g, " ").trim();
}

// Para voz: por extenso. Para WhatsApp/dev: curto.
function formatWhen(channel: "whatsapp" | "voice", isoUtc: string) {
  return channel === "voice" ? formatLocalSpokenWords(isoUtc) : formatLocalShort(isoUtc);
}

export async function runAgent(params: {
  clinicId: string;
  channel: "whatsapp" | "voice";
  userKey: string; // telefone / wa_id / caller
  userText: string;
}): Promise<{ type: "say"; text: string }> {
  const clinic = await prisma.clinic.findUnique({ where: { id: params.clinicId } });
  if (!clinic) return { type: "say", text: "Clínica não encontrada." };

  const services = await prisma.service.findMany({ where: { clinicId: params.clinicId } });

  const session = await prisma.session.upsert({
    where: {
      clinicId_channel_userKey: {
        clinicId: params.clinicId,
        channel: params.channel,
        userKey: params.userKey,
      },
    },
    update: {},
    create: {
      clinicId: params.clinicId,
      channel: params.channel,
      userKey: params.userKey,
      stateJson: {},
    },
  });

  // ✅ Modo sem LLM
  if (process.env.LLM_MODE === "stub") {
    const state = (session.stateJson as any) ?? {};
    const text = (params.userText ?? "").trim();

    // 1) escolher serviço
    if (!state.serviceId) {
      const choice = parseInt(text, 10);
      const chosenByNumber =
        Number.isFinite(choice) && choice >= 1 && choice <= services.length
          ? services[choice - 1]
          : null;

      const chosenById = services.find((s) => s.id === text);
      const chosenByName = services.find((s) =>
        s.name.toLowerCase().includes(text.toLowerCase())
      );

      const chosen = chosenByNumber ?? chosenById ?? chosenByName;

      if (!chosen) {
        const list = services
          .map((s, i) => `${i + 1}) ${s.name} — ${s.durationMin}min`)
          .join("\n");

        await prisma.session.update({
          where: { id: session.id },
          data: { stateJson: { step: "choose_service" } },
        });

        return {
          type: "say",
          text:
            params.channel === "voice"
              ? `Certo. Qual serviço você quer?\n${list}\nResponda com 1, 2, 3...`
              : `Beleza! Qual serviço você quer?\n\n${list}\n\nResponda com o número (1, 2, 3...) ou digite parte do nome.`,
        };
      }

      await prisma.session.update({
        where: { id: session.id },
        data: { stateJson: { step: "choose_slot", serviceId: chosen.id } },
      });
    }

    const next = await prisma.session.findUnique({ where: { id: session.id } });
    const st = (next?.stateJson as any) ?? {};
    const serviceId = st.serviceId as string;

    // 2) listar slots
    if (!st.slots) {
      const avail = await toolsDispatchFn({
        clinicId: params.clinicId,
        userPhone: params.userKey,
        name: "search_availability",
        args: { serviceId },
      });

      if (!avail.ok || !avail.slots?.length) {
        return { type: "say", text: "Não encontrei horários agora. Quer tentar mais tarde?" };
      }

      await prisma.session.update({
        where: { id: session.id },
        data: { stateJson: { ...st, slots: avail.slots, step: "pick_slot" } },
      });

      const lines = avail.slots
        .map((s: any, i: number) => {
          const when = formatWhen(params.channel, s.startUtc);
          return `${i + 1}) ${when} (Prof.: ${s.staffName})`;
        })
        .join("\n");

      return {
        type: "say",
        text:
          params.channel === "voice"
            ? `Tenho estes horários.\n${lines}\nResponda com 1, 2 ou 3.`
            : `Tenho estes horários:\n\n${lines}\n\nResponda com 1, 2 ou 3.`,
      };
    }

    // 3) escolher slot e criar hold
    if (!st.holdId) {
      const choice = parseInt(text, 10);
      if (!choice || choice < 1 || choice > st.slots.length) {
        return { type: "say", text: "Escolha um horário respondendo com 1, 2 ou 3." };
      }

      const slot = st.slots[choice - 1];

      const holdRes = await toolsDispatchFn({
        clinicId: params.clinicId,
        userPhone: params.userKey,
        name: "create_hold",
        args: slot,
      });

      if (!holdRes.ok) {
        await prisma.session.update({
          where: { id: session.id },
          data: { stateJson: { serviceId, step: "choose_slot" } },
        });
        return { type: "say", text: holdRes.error ?? "Esse horário acabou de ser ocupado. Vamos tentar outro." };
      }

      await prisma.session.update({
        where: { id: session.id },
        data: { stateJson: { ...st, holdId: holdRes.holdId, step: "need_name" } },
      });

      return {
        type: "say",
        text: params.channel === "voice"
          ? "Perfeito. Diga seu nome completo para confirmar."
          : "Perfeito. Qual seu nome completo para confirmar?",
      };
    }

    // 4) confirmar booking
    if (st.step === "need_name") {
      const patientName = text;
      const idempotencyKey = `${params.clinicId}:${params.channel}:${params.userKey}:${st.holdId}`;

      const bookRes = await toolsDispatchFn({
        clinicId: params.clinicId,
        userPhone: params.userKey,
        name: "confirm_booking",
        args: { holdId: st.holdId, patientName, idempotencyKey },
      });

      if (!bookRes.ok) {
        await prisma.session.update({
          where: { id: session.id },
          data: { stateJson: { serviceId, step: "choose_slot" } },
        });
        return { type: "say", text: bookRes.error ?? "Esse horário não está mais disponível. Vamos tentar outro." };
      }

      await prisma.session.update({ where: { id: session.id }, data: { stateJson: {} } });

      const when = formatWhen(params.channel, bookRes.startUtc);

      return {
        type: "say",
        text:
          params.channel === "voice"
            ? `Consulta confirmada. Para ${when}.`
            : `✅ Consulta confirmada!\nID: ${bookRes.bookingId}\nInício: ${when}\nGoogleEventId: ${bookRes.googleEventId ?? "ok"}`,
      };
    }

    await prisma.session.update({ where: { id: session.id }, data: { stateJson: {} } });
    return { type: "say", text: "Vamos recomeçar: qual serviço você quer?" };
  }

  // ✅ Com LLM (quando habilitar)
  const system = `Você é a secretária virtual de ${clinic.name}. Saída em JSON {"type":"say","text":"..."} ou {"type":"tool","name":"...","args":{...}}`;

  const out = await llmChat({
    system,
    messages: [{ role: "user", content: params.userText }],
  });

  const content = out?.choices?.[0]?.message?.content;
  return { type: "say", text: content ?? "Ok!" };
}
