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
    const { user, service, identity } = await clients(req);
    const { data: admin, error: ae } = await user.rpc("is_admin");
    if (ae || !admin) throw new Error("Nur Administration.");
    const b = await body(req);
    const table = () => service.from("scoped_provider_credentials");
    if (b.action !== "status") {
      if (!Object.hasOwn(PROVIDERS, b.provider))
        throw new Error("Unbekannter Anbieter.");
      if (!["private", "workshop"].includes(b.scope))
        throw new Error("Ungültige Freigabe.");
      const workshopId = b.scope === "workshop" ? b.workshopId : null;
      if (
        b.scope === "workshop" &&
        (typeof workshopId !== "string" || !/^[\da-f-]{36}$/i.test(workshopId))
      )
        throw new Error("Bitte einen Workshop auswählen.");
      const ownerId = workshopId ? null : identity.id;
      if (b.action === "delete") {
        const query = table().delete().eq("provider", b.provider);
        const { error } = await (ownerId
          ? query.eq("owner_id", ownerId).is("workshop_id", null)
          : query.eq("workshop_id", workshopId).is("owner_id", null));
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
        const { error } = await table().upsert(
          {
            provider: b.provider,
            owner_id: ownerId,
            workshop_id: workshopId,
            ...encrypted,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "provider,owner_id,workshop_id" },
        );
        if (error) throw new Error("Zugang konnte nicht gespeichert werden.");
      } else throw new Error("Ungültige Aktion.");
    }
    const { data, error } = await table()
      .select("provider,workshop_id,updated_at")
      .or(`owner_id.eq.${identity.id},workshop_id.not.is.null`);
    if (error) throw new Error("Status nicht verfügbar.");
    return Response.json({ credentials: data }, { headers: h });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." },
      { status: 400, headers: h },
    );
  }
});
