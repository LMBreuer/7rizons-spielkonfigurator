/** @returns {{url:string,headers:Record<string,string>,body:object}} */
export function providerRequest(provider, key, model, prompt) {
  if (!/^[\w.:-]{1,100}$/.test(model))
    throw new Error("Kein gültiges Modell eingerichtet.");
  if (provider === "openai")
    return {
      url: "https://api.openai.com/v1/responses",
      headers: { Authorization: `Bearer ${key}` },
      body: { model, input: prompt, store: false, max_output_tokens: 8000 },
    };
  if (provider === "anthropic")
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: {
        model,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      },
    };
  if (provider === "gemini")
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { "x-goog-api-key": key },
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 8000,
          responseMimeType: "application/json",
        },
      },
    };
  throw new Error("Unbekannter Anbieter.");
}
export function providerText(provider, d) {
  let text = "";
  if (provider === "openai") {
    if (d.status !== "completed")
      throw new Error("Die KI-Antwort ist unvollständig oder wurde abgelehnt.");
    text = (d.output || [])
      .flatMap((x) => x.content || [])
      .filter((x) => x.type === "output_text")
      .map((x) => x.text)
      .join("");
  } else if (provider === "anthropic") {
    if (d.stop_reason !== "end_turn")
      throw new Error("Die KI-Antwort ist unvollständig oder wurde abgelehnt.");
    text = (d.content || [])
      .filter((x) => x.type === "text")
      .map((x) => x.text)
      .join("");
  } else {
    const c = d.candidates?.[0];
    if (c?.finishReason !== "STOP")
      throw new Error("Die KI-Antwort ist unvollständig oder wurde abgelehnt.");
    text = (c.content?.parts || []).map((x) => x.text || "").join("");
  }
  if (!text || text.length > 150000)
    throw new Error("Keine vollständige KI-Antwort erhalten.");
  return text;
}
