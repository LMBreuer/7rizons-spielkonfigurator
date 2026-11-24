export function validCardText(value) {
  if (typeof value === "string") return value.length <= 4000;
  if (
    !value ||
    value.type !== "doc" ||
    !Array.isArray(value.content) ||
    !value.content.length ||
    Object.keys(value).length !== 2
  )
    return false;
  let length = value.content.length - 1;
  for (const p of value.content) {
    if (
      p?.type !== "paragraph" ||
      Object.keys(p).some((k) => !["type", "content"].includes(k)) ||
      (p.content !== undefined && !Array.isArray(p.content))
    )
      return false;
    for (const run of p.content || []) {
      if (
        run?.type !== "text" ||
        typeof run.text !== "string" ||
        !run.text ||
        Object.keys(run).some((k) => !["type", "text", "marks"].includes(k))
      )
        return false;
      if (
        run.marks !== undefined &&
        (!Array.isArray(run.marks) ||
          run.marks.length > 2 ||
          !run.marks.every(
            (m) =>
              m &&
              ["strong", "em"].includes(m.type) &&
              Object.keys(m).length === 1,
          ))
      )
        return false;
      length += run.text.length;
    }
  }
  return length <= 4000;
}

export function cardMarkdown(value) {
  if (typeof value !== "object" || !value) return value || "";
  return value.content
    .map((p) =>
      (p.content || [])
        .map((run) => {
          let text = run.text.replace(/[\\*_[\]`]/g, "\\$&");
          for (const mark of run.marks || []) {
            const wrap = mark.type === "strong" ? "**" : "_";
            text = wrap + text + wrap;
          }
          return text;
        })
        .join(""),
    )
    .join("\n\n");
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
      typeof card.id !== "string" ||
      !/^(?:[a-f0-9-]{36}|legacy-[a-z0-9_-]{1,58})$/i.test(card.id) ||
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
