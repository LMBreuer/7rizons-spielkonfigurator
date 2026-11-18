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
