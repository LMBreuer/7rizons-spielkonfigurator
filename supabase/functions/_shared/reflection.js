export const reflectionFields = {
  stars: "Sterne",
  wishes: "Wünsche",
  learning: "Woran war das Lernerlebnis erkennbar?",
  next: "Was ändern wir als Nächstes?",
};

export function validateReflections(reflections) {
  if (!Array.isArray(reflections))
    throw new Error("Ungültige Ergebnisblätter.");
  const ids = new Set();
  return reflections.map((item) => {
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(item.id) ||
      ids.has(item.id) ||
      typeof item.title !== "string" ||
      item.title.length > 120 ||
      Object.keys(reflectionFields).some(
        (key) => typeof item[key] !== "string" || item[key].length > 4000,
      )
    ) {
      throw new Error("Ungültige Ergebnisblätter.");
    }
    ids.add(item.id);
    const { id, title, stars, wishes, learning, next } = item;
    return { id, title, stars, wishes, learning, next };
  });
}
