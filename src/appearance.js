export const APPEARANCE_KEY = "7rizons:appearance:v2";
export function initialAppearance(storage) {
  try {
    const value = storage.getItem(APPEARANCE_KEY);
    return ["light", "dark", "contrast"].includes(value) ? value : "light";
  } catch {
    return "light";
  }
}

export const LAYOUT_KEY = "7rizons:layout:v1";
export function initialLayout(storage) {
  try {
    return storage.getItem(LAYOUT_KEY) === "classic" ? "classic" : "modern";
  } catch {
    return "modern";
  }
}

export const BACKGROUND_KEY = "7rizons:background:v1";
export function initialBackground(storage) {
  try {
    if (storage.getItem(BACKGROUND_KEY) === "cosmic-cliffs")
      return "cosmic-cliffs";
  } catch {}
  return "wave-grid";
}
