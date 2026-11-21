import { LE, MK } from "./catalog.js";
import guides from "./worksheet-guides.json" with { type: "json" };
import { translate } from "./translations.js";

export const blockDefaults = {
  introduction:
    "Dieses Arbeitsblatt fasst Ihre Auswahl zusammen. Entwickeln Sie eigene Beispiele und erproben Sie diese in einer kurzen Spielrunde.",
  safety:
    "Klären Sie vor dem Spiel mit CATS Inhalt, Ziel, Ton und Rahmen. Mit der X-Karte kann jede Person Inhalte ohne Begründung unterbrechen oder verändern. Open Door bedeutet, dass alle jederzeit pausieren oder aussteigen dürfen. Besprechen Sie das Erlebte anschließend gemeinsam.",
  playtest:
    "Spielen Sie eine kurze Szene. Woran war das gewählte Lernerlebnis erkennbar?",
  revision: "Was möchten Sie nach dem Probelauf ändern und warum?",
  closing:
    "Halten Sie Ihre Beobachtungen aus dem Probelauf und die Änderungen für die nächste Runde fest.",
};
export const learningFields = ["label", "desc", "bloom", "fuer", "hinweis"];
export const mechanicFields = [
  "label",
  "kurz",
  "desc",
  "kat",
  "questions",
  "frame",
  "example",
];
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const idPattern = /^[a-z][a-z0-9_-]{0,48}$/;
function invalid() {
  throw new Error("Ungültige Inhaltsfassung.");
}
function checkTexts(values, keys) {
  if (
    !object(values) ||
    Object.entries(values).some(
      ([k, v]) => !keys.includes(k) || typeof v !== "string" || v.length > 4000,
    )
  )
    invalid();
}
export function validateContent(content = {}) {
  if (
    !object(content) ||
    JSON.stringify(content).length > 120000 ||
    Object.keys(content).some(
      (k) => !["learning", "mechanics", "blocks"].includes(k),
    )
  )
    invalid();
  const goals = new Set([
    ...LE.map((l) => l.id),
    ...Object.keys(content.learning || {}),
  ]);
  for (const [section, fields, originals] of [
    ["learning", learningFields, LE],
    ["mechanics", mechanicFields, MK],
  ]) {
    const entries = content[section] ?? {};
    if (!object(entries) || Object.keys(entries).length > 100) invalid();
    for (const [id, item] of Object.entries(entries)) {
      if (
        !idPattern.test(id) ||
        ["other", "constructor", "prototype"].includes(id) ||
        !object(item)
      )
        invalid();
      const { en, archived, group, basis, w, ...texts } = item;
      checkTexts(texts, fields);
      if (en !== undefined) checkTexts(en, fields);
      if (archived !== undefined && typeof archived !== "boolean") invalid();
      if (!originals.some((x) => x.id === id) && !texts.label?.trim())
        invalid();
      if (texts.label !== undefined && !texts.label.trim()) invalid();
      if (section === "learning") {
        if (
          basis !== undefined ||
          w !== undefined ||
          (group !== undefined && !["inhalt", "wiss"].includes(group))
        )
          invalid();
      } else {
        if (
          group !== undefined ||
          (basis !== undefined && typeof basis !== "boolean") ||
          (MK.some((m) => m.id === id && m.kern) &&
            (archived || basis === false))
        )
          invalid();
        if (
          w !== undefined &&
          (!object(w) ||
            Object.entries(w).some(
              ([k, v]) => !goals.has(k) || !["P", "S", "~"].includes(v),
            ))
        )
          invalid();
      }
    }
  }
  if (content.blocks !== undefined) {
    if (!object(content.blocks)) invalid();
    const { en, ...texts } = content.blocks;
    checkTexts(texts, Object.keys(blockDefaults));
    if (en !== undefined) checkTexts(en, Object.keys(blockDefaults));
  }
  return content;
}

function localized(original, patch, fields, lang) {
  const result = { ...original, ...patch };
  delete result.en;
  if (lang === "en")
    for (const key of fields) {
      if (typeof result[key] === "string")
        result[key] = patch?.en?.[key] || translate(result[key], lang);
    }
  return result;
}
const cache = new WeakMap();
export function catalogFor(d = {}) {
  const edition = d.edition;
  const lang = d.language || "de";
  if (!edition) return { LE, MK, guides, blocks: blockDefaults };
  const existing = cache.get(edition)?.[lang];
  if (existing) return existing;
  validateContent(edition);
  function merge(originals, patches, defaults, fields) {
    const byId = new Map(originals.map((x) => [x.id, x]));
    for (const [id, patch] of Object.entries(patches || {})) {
      byId.set(
        id,
        localized(byId.get(id) || { id, ...defaults }, patch, fields, lang),
      );
    }
    return [...byId.values()];
  }
  const mechanics = merge(
    MK,
    edition.mechanics,
    { w: {}, kat: "Weitere Mechaniken", kurz: "", desc: "" },
    mechanicFields,
  );
  const guideEntries = Object.fromEntries(
    mechanics.map((m) => {
      const patch = edition.mechanics?.[m.id];
      const base = localized(
        guides[m.id] || { questions: "", frame: "", example: "" },
        patch,
        ["questions", "frame", "example"],
        lang,
      );
      return [
        m.id,
        { questions: base.questions, frame: base.frame, example: base.example },
      ];
    }),
  );
  const result = {
    LE: merge(
      LE,
      edition.learning,
      { group: "inhalt", desc: "", bloom: "" },
      learningFields,
    ),
    MK: mechanics,
    guides: guideEntries,
    blocks: localized(
      blockDefaults,
      edition.blocks,
      Object.keys(blockDefaults),
      lang,
    ),
  };
  cache.set(edition, { ...cache.get(edition), [lang]: result });
  return result;
}
