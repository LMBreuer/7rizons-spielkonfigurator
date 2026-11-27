import {
  DEFAULT_CARD_COLOR,
  validateCardTypes,
  validateWorksheetCards,
  worksheetCards,
} from "../supabase/functions/_shared/card-text.js";
import {
  cardFontKey,
  CARD_PRINT_DEFAULTS,
  CARD_PRINT_DESIGNS,
  CARD_PRINT_SIZES,
  cardPrintStyle,
  readCardPrint,
} from "../supabase/functions/_shared/card-print.js";
import {
  CARD_GROUPS,
  cardGroup,
} from "../supabase/functions/_shared/card-groups.js";
import {
  cardDocument,
  parseCardMarkdown,
  serializeCardMarkdown,
} from "./card-editor-format.js";

const kind = "7rizons-cards";
const markdownFor = (text) => serializeCardMarkdown(cardDocument(text));
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);

export function exportCardFile({
  result,
  worksheetId,
  settings,
  typeName,
  template,
  t,
}) {
  const {
    fontSizes,
    cardStyles,
    backText,
    back,
    backImage,
    backColor,
    ...options
  } = readCardPrint(settings);
  const availableTypes = (
    result.mechanisms.length
      ? result.mechanisms.map((m) => m.mechanismId)
      : [null]
  ).map((mechanismId) => ({ mechanismId, label: typeName(mechanismId) }));
  return {
    kind,
    schemaVersion: 1,
    ...(template && {
      instructions: t(
        "Ersetzen Sie die Beispielkarte in cards durch alle gewünschten Karten. Geben Sie ein einziges gültiges JSON-Objekt zurück und übernehmen Sie kind und schemaVersion. Verwenden Sie pro Karte genau eine mechanismId aus availableTypes. Schreiben Sie den Kartentext als Markdown in textMarkdown. Setzen Sie eine Trennlinie als --- in eine eigene Zeile mit Leerzeilen davor und danach. Lassen Sie id für neue Karten weg. Nutzen Sie für Farben das Format #RRGGBB und für Schriftgrößen die Wertebereiche in format.",
      ),
      format: {
        design: CARD_PRINT_DESIGNS,
        orientation: ["portrait", "landscape"],
        paper: ["white", "cream", "dark"],
        fontSizePt: CARD_PRINT_SIZES,
      },
      availableGroups: Object.entries(CARD_GROUPS).map(
        ([group, { label }]) => ({
          group,
          label: t(label),
        }),
      ),
      cardGroupInstructions: t(
        "Wählen Sie für die Rückseite einer Karte optional eine group aus availableGroups. Ohne group wird die Rückseite aus der Mechanik abgeleitet.",
      ),
    }),
    availableTypes,
    ...((template || result.cardTypes) && { types: result.cardTypes || {} }),
    settings: {
      ...options,
      ...(!template && {
        back,
        backImage,
        backColor,
        backTextMarkdown: markdownFor(backText),
      }),
    },
    cards: template
      ? [
          {
            mechanismId: availableTypes[0].mechanismId,
            group: cardGroup(availableTypes[0]),
            title: t("Beispielkarte"),
            textMarkdown: [
              "## " + t("Situation"),
              t("Beschreibung"),
              "---",
              "## " + t("Anweisung"),
              t("Arbeitsauftrag"),
            ].join("\n\n"),
            color: DEFAULT_CARD_COLOR,
            notes: [],
            print: cardPrintStyle(CARD_PRINT_DEFAULTS, worksheetId, {
              color: DEFAULT_CARD_COLOR,
            }),
          },
        ]
      : worksheetCards(result).map(
          ({ id, mechanismId, title, text, color, notes, group }) => ({
            id,
            mechanismId,
            ...(group !== undefined && { group }),
            title,
            textMarkdown: markdownFor(text),
            color,
            notes,
            print: cardPrintStyle(settings, worksheetId, { id, color }),
          }),
        ),
  };
}

export function parseCardFile(text) {
  const input = text.trim();
  const fence =
    /^\x60\x60\x60(?:json)?[^\S\r\n]*\r?\n([\s\S]*?)\r?\n\x60\x60\x60$/i.exec(
      input,
    );
  try {
    return JSON.parse(fence?.[1] ?? input);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error("Die Karten-Datei enthält kein gültiges JSON.");
  }
}

function textFromMarkdown(value) {
  if (typeof value !== "string")
    throw new Error(
      "Der Kartentext muss als Markdown im Feld textMarkdown stehen.",
    );
  const doc = parseCardMarkdown(value);
  if (!doc)
    throw new Error("Ein Kartentext ist zu lang oder zu tief verschachtelt.");
  return value.trim() ? doc.toJSON() : "";
}

function sameCard(a, b) {
  return (
    a.mechanismId === b.mechanismId &&
    cardGroup(a) === cardGroup(b) &&
    a.title === b.title &&
    a.color.toLowerCase() === b.color.toLowerCase() &&
    markdownFor(a.text) === markdownFor(b.text) &&
    JSON.stringify(a.notes) === JSON.stringify(b.notes)
  );
}

export function importCardFile(raw, result, worksheetId, currentSettings) {
  if (
    raw?.kind !== kind ||
    raw.schemaVersion !== 1 ||
    !Array.isArray(raw.cards) ||
    !raw.cards.length
  ) {
    throw new Error("Die Datei ist kein 7’rizons-Karten-JSON (Version 1).");
  }
  const targets = result.mechanisms.length
    ? result.mechanisms.map((m) => m.mechanismId)
    : [null];
  const added = [];
  const styles = {};
  const fonts = {};
  const seen = new Set();
  const existing = new Map(
    worksheetCards(result).map((card) => [card.id, card]),
  );
  let skipped = 0;
  for (const item of raw.cards) {
    if (!object(item)) throw new Error("Ungültige Spielkarten.");
    const id = item.id ?? crypto.randomUUID();
    if (seen.has(id)) throw new Error("Ungültige oder doppelte Kartenkennung.");
    seen.add(id);
    const mechanismId =
      item.mechanismId === undefined && targets.length === 1
        ? targets[0]
        : item.mechanismId;
    if (!targets.includes(mechanismId))
      throw new Error(
        "Eine Karte gehört zu einem Kartentyp, den dieses Arbeitsblatt nicht enthält. Verwenden Sie die mechanismId aus der Vorlage dieses Arbeitsblatts.",
      );
    const [incoming] = validateWorksheetCards(
      [
        {
          id,
          mechanismId,
          group: item.group,
          title: item.title,
          text: textFromMarkdown(item.textMarkdown),
          color: item.color ?? DEFAULT_CARD_COLOR,
          notes: item.notes ?? [],
        },
      ],
      result.mechanisms,
    );
    const before = existing.get(id);
    if (before && sameCard(before, incoming)) skipped++;
    else {
      if (before) incoming.id = crypto.randomUUID();
      added.push(incoming);
    }
    if (object(item.print)) {
      const key = cardFontKey(worksheetId, incoming.id);
      if (Object.hasOwn(item.print, "body")) fonts[key] = item.print.body;
      const style = { ...currentSettings.cardStyles?.[key] };
      for (const field of ["title", "type", "color"]) {
        if (Object.hasOwn(item.print, field)) style[field] = item.print[field];
      }
      if (style.color === incoming.color) delete style.color;
      styles[key] = style;
    }
  }
  const knownLabels =
    raw.types === undefined
      ? {}
      : validateCardTypes(raw.types, result.mechanisms);
  const types = { ...result.cardTypes, ...knownLabels };
  const next = object(raw.settings) ? raw.settings : {};
  const projectOptions = {};
  for (const key of [
    "design",
    "orientation",
    "paper",
    "back",
    "backImage",
    "backColor",
    "includeBacks",
  ]) {
    if (Object.hasOwn(next, key)) projectOptions[key] = next[key];
  }
  if (Object.hasOwn(next, "backTextMarkdown"))
    projectOptions.backText = textFromMarkdown(next.backTextMarkdown);
  const settings = readCardPrint({
    ...CARD_PRINT_DEFAULTS,
    ...currentSettings,
    ...projectOptions,
    fontSizes: { ...currentSettings.fontSizes, ...fonts },
    cardStyles: { ...currentSettings.cardStyles, ...styles },
  });
  return { added, skipped, types, settings };
}
