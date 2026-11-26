export const CARD_PRINT_DEFAULTS = Object.freeze({
  design: "minimal",
  orientation: "portrait",
  paper: "white",
  back: "text",
  backText: "",
  backImage: "",
  includeBacks: true,
  fontSizes: Object.freeze({}),
});

export const CARD_PRINT_FONT = 10.5;
export const CARD_PRINT_IMAGE_LIMIT = 360000;
export const CARD_PRINT_DESIGNS = [
  "minimal",
  "retro",
  "future",
  "split",
  "curve",
];

export function cardFontKey(worksheetId, cardId) {
  return worksheetId + ":" + cardId;
}

export function readCardPrint(value) {
  const raw = value || {};
  const backImage =
    typeof raw.backImage === "string" &&
    raw.backImage.length <= CARD_PRINT_IMAGE_LIMIT &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      raw.backImage,
    )
      ? raw.backImage
      : "";
  const fontSizes = {};
  const entries =
    raw.fontSizes && typeof raw.fontSizes === "object"
      ? Object.entries(raw.fontSizes)
      : [];
  for (const [key, size] of entries) {
    if (
      /^[a-f0-9-]{36}:[\w-]{1,100}$/i.test(key) &&
      Number.isFinite(size) &&
      size >= 8 &&
      size <= 14 &&
      size !== CARD_PRINT_FONT
    )
      fontSizes[key] = Math.round(size * 2) / 2;
  }
  return {
    design: CARD_PRINT_DESIGNS.includes(raw.design) ? raw.design : "minimal",
    orientation: raw.orientation === "landscape" ? "landscape" : "portrait",
    paper: ["cream", "dark"].includes(raw.paper) ? raw.paper : "white",
    back: raw.back === "image" && backImage ? "image" : "text",
    backText:
      typeof raw.backText === "string" ? raw.backText.slice(0, 240) : "",
    backImage,
    includeBacks: raw.includeBacks !== false,
    fontSizes,
  };
}

// Omit unmodified defaults so projects exported before this feature keep their fingerprint.
export function savedCardPrint(settings) {
  const { fontSizes, ...options } = readCardPrint(settings);
  const changed = Object.entries(options).some(
    ([key, value]) => value !== CARD_PRINT_DEFAULTS[key],
  );
  return changed || Object.keys(fontSizes).length
    ? { ...options, fontSizes }
    : undefined;
}
