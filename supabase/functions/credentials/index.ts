import { headers, clients, body } from "../_shared/http.ts";
import { seal } from "../_shared/crypto.js";
import { PROVIDERS } from "../_shared/domain.js";
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
    const { user, service } = await clients(req);
    const { data: admin, error: ae } = await user.rpc("is_admin");
    if (ae || !admin) throw new Error("Nur Administration.");
    const b = await body(req);
    if (!Object.hasOwn(PROVIDERS, b.provider))
      throw new Error("Unbekannter Anbieter.");
    if (b.action === "delete") {
      const { error } = await service
        .from("provider_credentials")
        .delete()
        .eq("provider", b.provider);
      if (error) throw new Error("Zugang konnte nicht entfernt werden.");
    } else if (b.action === "set") {
      if (
        typeof b.apiKey !== "string" ||
        b.apiKey.length < 16 ||
        b.apiKey.length > 1000 ||
        /[\r\n]/.test(b.apiKey)
      )
        throw new Error("Ungültiger API-Key.");
      const encrypted = await seal(
        b.apiKey,
        Deno.env.get("CREDENTIAL_ENCRYPTION_KEY") || "",
      );
      b.apiKey = null;
      const { error } = await service
        .from("provider_credentials")
        .upsert({
          provider: b.provider,
          ...encrypted,
          updated_at: new Date().toISOString(),
        });
      if (error) throw new Error("Zugang konnte nicht gespeichert werden.");
    } else if (b.action !== "status") throw new Error("Ungültige Aktion.");
    const { data, error } = await service
      .from("provider_credentials")
      .select("provider,updated_at");
    if (error) throw new Error("Status nicht verfügbar.");
    return Response.json({ credentials: data }, { headers: h });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." },
      { status: 400, headers: h },
    );
  }
});
