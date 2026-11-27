import { isCardGroup } from "./card-groups.js";

const blocks = [
  "paragraph",
  "heading",
  "horizontal_rule",
  "bullet_list",
  "ordered_list",
];
const inline = ["text", "hard_break"];
const blockChildren = {
  doc: blocks,
  paragraph: inline,
  heading: inline,
  horizontal_rule: [],
  hard_break: [],
  bullet_list: ["list_item"],
  ordered_list: ["list_item"],
  list_item: blocks,
};

export function validCardText(value) {
  if (typeof value === "string") return value.length <= 4000;
  let length = 0;
  let nodes = 0;
  function valid(node, depth) {
    if (!node || depth > 8 || ++nodes > 8001) return false;
    if (node.type === "text") {
      if (
        typeof node.text !== "string" ||
        !node.text ||
        Object.keys(node).some(
          (key) => !["type", "text", "marks"].includes(key),
        )
      )
        return false;
      length += node.text.length;
      return (
        length <= 4001 &&
        (node.marks === undefined ||
          (Array.isArray(node.marks) &&
            node.marks.length <= 2 &&
            node.marks.every(
              (mark) =>
                mark &&
                ["strong", "em"].includes(mark.type) &&
                Object.keys(mark).length === 1,
            )))
      );
    }
    if (
      !Object.hasOwn(blockChildren, node.type) ||
      Object.keys(node).some(
        (key) =>
          ![
            "type",
            "content",
            ...(["ordered_list", "heading"].includes(node.type)
              ? ["attrs"]
              : []),
          ].includes(key),
      )
    )
      return false;
    if (
      node.type === "ordered_list" &&
      node.attrs !== undefined &&
      (!node.attrs ||
        Object.keys(node.attrs).length !== 1 ||
        !Number.isInteger(node.attrs.order) ||
        node.attrs.order < 1 ||
        node.attrs.order > 9999)
    )
      return false;
    if (
      node.type === "heading" &&
      (!node.attrs ||
        Object.keys(node.attrs).length !== 1 ||
        !Number.isInteger(node.attrs.level) ||
        node.attrs.level < 1 ||
        node.attrs.level > 6)
    )
      return false;
    if (node.type === "horizontal_rule" || node.type === "hard_break") {
      length += 1;
      return node.content === undefined && length <= 4001;
    }
    const textBlock = node.type === "paragraph" || node.type === "heading";
    if (textBlock) {
      length += 1;
      if (node.content === undefined) return length <= 4001;
    }
    if (!Array.isArray(node.content) || (!textBlock && !node.content.length))
      return false;
    if (node.type === "list_item" && node.content[0]?.type !== "paragraph")
      return false;
    return node.content.every(
      (child) =>
        blockChildren[node.type].includes(child?.type) &&
        valid(child, depth + 1),
    );
  }
  return value?.type === "doc" && valid(value, 0) && length <= 4001;
}

export function plainCardText(value) {
  if (typeof value === "string") return value;
  if (!value) return "";
  if (value.type === "text") return value.text;
  if (value.type === "horizontal_rule") return "---";
  if (value.type === "hard_break") return "\n";
  return (value.content || [])
    .map(plainCardText)
    .join(["paragraph", "heading"].includes(value.type) ? "" : "\n");
}

export function cardTextSections(card) {
  if (card.instruction !== undefined) {
    return { introduction: card.text, instruction: card.instruction };
  }
  const text = card.text;
  if (typeof text === "string") {
    const divider = /^[\t ]*---[\t ]*\r?$/m.exec(text);
    if (divider)
      return {
        introduction: text.slice(0, divider.index).trimEnd(),
        instruction: text.slice(divider.index + divider[0].length).trimStart(),
      };
  } else {
    const blocks = text.content;
    const divider = blocks.findIndex((block) => block.type === "horizontal_rule");
    if (divider !== -1) {
      const part = (content) => content.length ? { type: "doc", content } : "";
      return {
        introduction: part(blocks.slice(0, divider)),
        instruction: part(blocks.slice(divider + 1)),
      };
    }
  }
  return { introduction: text, instruction: "" };
}

export function cardMarkdown(value) {
  if (typeof value === "string") return value.replace(/[<>]/g, "\\$&");
  if (!value) return "";
  if (value.type === "text") {
    let text = value.text.replace(/[\\*_[\]`<>]/g, "\\$&");
    for (const mark of value.marks || []) {
      const wrap = mark.type === "strong" ? "**" : "_";
      text = wrap + text + wrap;
    }
    return text;
  }
  if (value.type === "horizontal_rule") return "---";
  if (value.type === "hard_break") return "  \n";
  const children = (value.content || []).map(cardMarkdown);
  if (value.type === "heading")
    return "#".repeat(value.attrs.level) + " " + children.join("");
  if (value.type === "bullet_list" || value.type === "ordered_list")
    return children
      .map((text, index) => {
        const prefix =
          value.type === "bullet_list"
            ? "- "
            : (value.attrs?.order || 1) + index + ". ";
        return prefix + text.replaceAll("\n", "\n" + " ".repeat(prefix.length));
      })
      .join("\n");
  return children.join(value.type === "paragraph" ? "" : "\n\n");
}

export const DEFAULT_CARD_COLOR = "#2a6fb4";
export const CARD_TYPE_LIMIT = 120;
export const cardTypeKey = (id) => id ?? "unassigned";
export const isCardColor = (color) =>
  typeof color === "string" && /^#[a-f0-9]{6}$/i.test(color);

export function cardTypeName(result, mechanicId, defaultName) {
  return result.cardTypes?.[cardTypeKey(mechanicId)] || defaultName;
}

export function validateCardTypes(value, mechanisms) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Ungültige Kartentypen.");
  const allowed = new Set(
    mechanisms.length
      ? mechanisms.map((mechanic) => mechanic.mechanismId)
      : ["unassigned"],
  );
  const result = {};
  for (const [id, label] of Object.entries(value)) {
    if (
      !allowed.has(id) ||
      typeof label !== "string" ||
      label.length > CARD_TYPE_LIMIT
    )
      throw new Error("Ungültige Kartentypen.");
    if (label.trim()) result[id] = label.trim();
  }
  return result;
}

// Read old numbered answers as individual cards until the worksheet is edited.
export function worksheetCards(result) {
  if (result.cards) return result.cards;
  return Object.entries(result.answers || {})
    .filter(([key, text]) => key !== "playtest" && text)
    .map(([key, text]) => ({
      id: "legacy-" + key,
      mechanismId: key.replace(/-\d+$/, ""),
      title: "",
      text,
      color: DEFAULT_CARD_COLOR,
      notes: [],
    }));
}

export function validateWorksheetCards(cards, mechanisms) {
  if (!Array.isArray(cards)) throw new Error("Ungültige Spielkarten.");
  const ids = new Set();
  const mechanicIds = new Set(
    mechanisms.length ? mechanisms.map((m) => m.mechanismId) : [null],
  );
  return cards.map((card) => {
    if (
      !card ||
      !validEntryId(card.id) ||
      ids.has(card.id) ||
      !mechanicIds.has(card.mechanismId) ||
      typeof card.title !== "string" ||
      card.title.length > 120 ||
      !validCardText(card.text) ||
      (card.instruction !== undefined && !validCardText(card.instruction)) ||
      !isCardColor(card.color) ||
      (card.group !== undefined && !isCardGroup(card.group)) ||
      !Array.isArray(card.notes) ||
      !card.notes.every(
        (note) => typeof note === "string" && note.length <= 4000,
      )
    ) {
      throw new Error("Ungültige Spielkarten.");
    }
    ids.add(card.id);
    const { id, mechanismId, title, text, instruction, color, notes, group } =
      card;
    return {
      id,
      mechanismId,
      title,
      text,
      ...(instruction !== undefined && { instruction }),
      color,
      notes: [...notes],
      ...(group !== undefined && { group }),
    };
  });
}

export function notesForWorksheet(notes, mechanisms, cards) {
  if (!Array.isArray(notes)) throw new Error("Ungültige freie Notizen.");
  const ids = new Set();
  const mechanicIds = new Set(
    mechanisms.length ? mechanisms.map((m) => m.mechanismId) : [null],
  );
  const cardGroups = new Map(cards.map((card) => [card.id, card.mechanismId]));
  return notes.map((note) => {
    if (
      !note ||
      !validEntryId(note.id) ||
      ids.has(note.id) ||
      !mechanicIds.has(note.mechanismId) ||
      !validCardText(note.text) ||
      (note.after !== undefined &&
        (!validEntryId(note.after) ||
          cardGroups.get(note.after) !== note.mechanismId))
    ) {
      throw new Error("Ungültige freie Notizen.");
    }
    ids.add(note.id);
    const { id, mechanismId, text, after } = note;
    return { id, mechanismId, text, ...(after ? { after } : {}) };
  });
}

function validEntryId(id) {
  return (
    typeof id === "string" &&
    /^(?:[a-f0-9-]{36}|legacy-[a-z0-9_-]{1,58})$/i.test(id)
  );
}

export function worksheetEdits(result) {
  const { answers, cards, cardTypes, notes, reflections } = result;
  return {
    ...(answers !== undefined ? { answers } : {}),
    ...(cards !== undefined ? { cards } : {}),
    ...(cardTypes !== undefined ? { cardTypes } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(reflections !== undefined ? { reflections } : {}),
  };
}

export function resultWithWorksheetEdits(result, edits) {
  const { answers, cards, cardTypes, notes, reflections, ...generated } =
    result;
  return { ...generated, ...edits };
}
