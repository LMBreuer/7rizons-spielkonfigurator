const blockChildren = {
  doc: ["paragraph", "bullet_list", "ordered_list"],
  paragraph: ["text"],
  bullet_list: ["list_item"],
  ordered_list: ["list_item"],
  list_item: ["paragraph", "bullet_list", "ordered_list"],
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
            ...(node.type === "ordered_list" ? ["attrs"] : []),
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
    if (node.type === "paragraph") {
      length += 1;
      if (node.content === undefined) return length <= 4001;
    }
    if (
      !Array.isArray(node.content) ||
      (node.type !== "paragraph" && !node.content.length)
    )
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
  return (value.content || [])
    .map(plainCardText)
    .join(value.type === "paragraph" ? "" : "\n");
}

export function cardMarkdown(value) {
  if (typeof value !== "object" || !value) return value || "";
  if (value.type === "text") {
    let text = value.text.replace(/[\\*_[\]`]/g, "\\$&");
    for (const mark of value.marks || []) {
      const wrap = mark.type === "strong" ? "**" : "_";
      text = wrap + text + wrap;
    }
    return text;
  }
  const children = (value.content || []).map(cardMarkdown);
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
      typeof card.color !== "string" ||
      !/^#[a-f0-9]{6}$/i.test(card.color) ||
      !Array.isArray(card.notes) ||
      !card.notes.every(
        (note) => typeof note === "string" && note.length <= 4000,
      )
    ) {
      throw new Error("Ungültige Spielkarten.");
    }
    ids.add(card.id);
    const { id, mechanismId, title, text, color, notes } = card;
    return { id, mechanismId, title, text, color, notes: [...notes] };
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
  const { answers, cards, notes, reflections } = result;
  return {
    ...(answers !== undefined ? { answers } : {}),
    ...(cards !== undefined ? { cards } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(reflections !== undefined ? { reflections } : {}),
  };
}

export function resultWithWorksheetEdits(result, edits) {
  const { answers, cards, notes, reflections, ...generated } = result;
  return { ...generated, ...edits };
}
