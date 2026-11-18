// English translations are maintained centrally in locales/en.json.
// German source wording is the fallback; identifiers and user content are never translated.
import en from "./locales/en.json" with { type: "json" };
export function translate(text, language = "de", values = {}) {
  if (typeof text !== "string") return text;
  const key = text.trim().replace(/\s+/g, " ");
  const translated = language === "en" ? (en[key] ?? key) : key;
  const leading = text.match(/^\s*/)[0],
    trailing = text.match(/\s*$/)[0];
  return (leading + translated + trailing).replace(/\{(\d+)\}/g, (match, i) =>
    values[i] === undefined ? match : String(values[i]),
  );
}
export function localizeCatalog(items, language) {
  return items.map((item) =>
    Object.fromEntries(
      Object.entries(item).map(([key, value]) => [
        key,
        ["label", "desc", "kurz", "kat", "bloom", "fuer", "hinweis"].includes(
          key,
        )
          ? translate(value, language)
          : value,
      ]),
    ),
  );
}
