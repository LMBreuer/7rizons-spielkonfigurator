export const APPEARANCE_KEY = "7rizons:appearance:v2";
export function initialAppearance(storage) {
  try {
    const value = storage.getItem(APPEARANCE_KEY);
    return ["light", "dark", "contrast"].includes(value) ? value : "light";
  } catch {
    return "light";
  }
}
