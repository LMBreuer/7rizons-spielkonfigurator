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
