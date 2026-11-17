import { createClient } from "@supabase/supabase-js";
export const cloud =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      )
    : null;
export function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
export async function callFunction(name, payload) {
  if (!cloud) throw new Error("Der Online-Zugang ist noch nicht eingerichtet.");
  const { data, error } = await cloud.functions.invoke(name, { body: payload });
  if (error) {
    let message = "Der Online-Aufruf ist fehlgeschlagen.";
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
