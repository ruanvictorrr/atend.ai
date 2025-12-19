export async function sendWhatsAppText(params: {
  phoneNumberId: string; // metadata.phone_number_id (por clínica)
  to: string;            // telefone do usuário (E.164 sem + geralmente)
  text: string;
}) {
  const url = `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "text",
      text: { body: params.text },
    }),
  });

  if (!res.ok) throw new Error(await res.text());
}
