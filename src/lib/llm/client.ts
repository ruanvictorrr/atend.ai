export async function llmChat(params: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const base = process.env.LLM_BASE_URL;
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!base || !key || !model) {
    throw new Error("LLM env faltando: defina LLM_BASE_URL, LLM_API_KEY e LLM_MODEL no .env e reinicie o dev server.");
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: "system", content: params.system }, ...params.messages],
      response_format: { type: "json_object" }
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LLM error ${res.status}: ${t}`);
  }

  return res.json() as Promise<any>;
}
