import { createClient } from "npm:@supabase/supabase-js@2";
export function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (origin && !allowed.includes(origin))
    throw new Error("Ursprung nicht freigeschaltet.");
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin || allowed[0] || "null",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}
export async function clients(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const user = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    },
  );
  const { data, error } = await user.auth.getUser();
  if (error || !data.user) throw new Error("Bitte erneut anmelden.");
  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return { user, service, identity: data.user };
}
export async function body(req: Request) {
  const value = await req.text();
  if (value.length > 200000) throw new Error("Anfrage zu groß.");
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Ungültige Anfrage.");
  }
}
