import { headers, clients, body } from "../_shared/http.ts";
import {
  requestFor,
  makePrompt,
  parseResult,
  settingsOf,
  PROVIDERS,
} from "../_shared/domain.js";
import { providerRequest, providerText } from "../_shared/providers.js";
import { unseal } from "../_shared/crypto.js";
Deno.serve(async (req) => {
  let h;
  try {
    h = headers(req);
  } catch {
    return new Response(null, { status: 403 });
  }
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  if (req.method !== "POST")
    return new Response(null, { status: 405, headers: h });
  try {
    const { user, service, identity } = await clients(req);
    const b = await body(req);
    if (
      !Object.hasOwn(PROVIDERS, b.provider) ||
      !["personal", "workshop"].includes(b.mode)
    )
      throw new Error("Unbekannter KI-Zugang.");
    const { data: row, error: se } = await user
      .from("app_settings")
      .select("value")
      .eq("id", true)
      .single();
    if (se) throw new Error("Einstellungen konnten nicht geladen werden.");
    const settings = settingsOf(row.value);
    const model = settings.models[b.provider as keyof typeof settings.models];
    if (!model)
      throw new Error("Dieser Anbieter ist noch nicht freigeschaltet.");
    const request = requestFor(b.draft, settings);
    let key = b.mode === "personal" ? b.apiKey : null;
    if (
      b.mode === "workshop" &&
      (typeof b.workshopId !== "string" ||
        !/^[\da-f-]{36}$/i.test(b.workshopId))
    )
      throw new Error("Bitte einem Workshop beitreten.");
    if (
      b.mode === "personal" &&
      (typeof key !== "string" ||
        key.length < 16 ||
        key.length > 1000 ||
        /[\r\n]/.test(key))
    )
      throw new Error("Bitte einen gültigen API-Key eintragen.");
    const { error: limit } = await service.rpc("reserve_generation", {
      p_user: identity.id,
      p_workshop: b.mode === "workshop" ? b.workshopId : null,
      p_hourly: settings.hourlyLimit,
    });
    if (limit) throw new Error(limit.message);
    if (b.mode === "workshop") {
      const { data: record, error } = await service
        .from("provider_credentials")
        .select("ciphertext,iv")
        .eq("provider", b.provider)
        .single();
      if (error || !record)
        throw new Error(
          "Für diesen Anbieter ist noch kein Workshop-Zugang hinterlegt.",
        );
      key = await unseal(
        record,
        Deno.env.get("CREDENTIAL_ENCRYPTION_KEY") || "",
      );
    }
    const spec = providerRequest(b.provider, key, model, makePrompt(request));
    let response;
    try {
      response = await fetch(spec.url, {
        method: "POST",
        headers: { ...spec.headers, "Content-Type": "application/json" },
        body: JSON.stringify(spec.body),
        signal: AbortSignal.timeout(110000),
      });
    } catch {
      throw new Error(
        "Der KI-Anbieter hat nicht rechtzeitig geantwortet. Es erfolgt keine automatische Wiederholung; beim Anbieter können bereits Kosten entstanden sein.",
      );
    }
    key = null;
    b.apiKey = null;
    if (!response.ok) {
      const message =
        response.status === 429
          ? "Der Anbieter meldet ein Kontingent- oder Ratenlimit."
          : response.status === 401 || response.status === 403
            ? "Der Anbieter hat diesen Zugang abgelehnt. Prüfe API-Key und Modellfreigabe."
            : `KI-Anbieter derzeit nicht verfügbar (HTTP ${response.status}).`;
      throw new Error(message);
    }
    const result = parseResult(
      providerText(b.provider, await response.json()),
      request,
    );
    return Response.json(
      {
        result,
        source: {
          kind: b.mode,
          provider: b.provider,
          model,
          createdAt: new Date().toISOString(),
        },
        request,
      },
      { headers: h },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Die Generierung ist fehlgeschlagen.",
      },
      { status: 400, headers: h },
    );
  }
});
