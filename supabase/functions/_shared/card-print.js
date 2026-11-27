import { isCardColor, validCardText } from "./card-text.js";

const emptyMap = Object.freeze({});
export const CARD_PRINT_DEFAULTS = Object.freeze({
  design: "minimal",
  orientation: "portrait",
  paper: "white",
  back: "text",
  backText: "",
  backImage: "",
  backColor: "",
  includeBacks: true,
  fontSizes: emptyMap,
  cardStyles: emptyMap,
});

export const CARD_PRINT_SIZES = Object.freeze({
  body: { default: 10.5, min: 8, max: 14 },
  title: { default: 16, min: 10, max: 26 },
  type: { default: 8.5, min: 6, max: 14 },
});
export const CARD_PRINT_FONT = CARD_PRINT_SIZES.body.default;
export const CARD_PRINT_IMAGE_LIMIT = 360000;
export const CARD_PRINT_DESIGNS = [
  "minimal",
  "retro",
  "future",
  "split",
  "curve",
];

export const cardFontKey = (worksheetId, cardId) => worksheetId + ":" + cardId;
export const defaultBackColor = (paper) =>
  paper === "dark" ? "#61bde4" : "#2a6fb4";
const validKey = /^[a-f0-9-]{36}:[\w-]{1,100}$/i;

function sizeInRange(size, range) {
  if (!Number.isFinite(size) || size < range.min || size > range.max)
    return undefined;
  const rounded = Math.round(size * 2) / 2;
  return rounded === range.default ? undefined : rounded;
}

export function readCardStyle(value) {
  const title = sizeInRange(value?.title, CARD_PRINT_SIZES.title);
  const type = sizeInRange(value?.type, CARD_PRINT_SIZES.type);
  const color = isCardColor(value?.color) ? value.color : undefined;
  return {
    ...(title && { title }),
    ...(type && { type }),
    ...(color && { color }),
  };
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
  for (const [key, value] of Object.entries(raw.fontSizes || {})) {
    const size = sizeInRange(value, CARD_PRINT_SIZES.body);
    if (validKey.test(key) && size) fontSizes[key] = size;
  }
  const cardStyles = {};
  for (const [key, value] of Object.entries(raw.cardStyles || {})) {
    const style = readCardStyle(value);
    if (validKey.test(key) && Object.keys(style).length)
      cardStyles[key] = style;
  }
  return {
    design: CARD_PRINT_DESIGNS.includes(raw.design) ? raw.design : "minimal",
    orientation: raw.orientation === "landscape" ? "landscape" : "portrait",
    paper: ["cream", "dark"].includes(raw.paper) ? raw.paper : "white",
    back: raw.back === "image" && backImage ? "image" : "text",
    backText: validCardText(raw.backText) ? raw.backText : "",
    backImage,
    backColor: isCardColor(raw.backColor) ? raw.backColor : "",
    includeBacks: raw.includeBacks !== false,
    fontSizes,
    cardStyles,
  };
}

// Optional new fields remain absent in older project fingerprints.
export function savedCardPrint(settings) {
  const { fontSizes, cardStyles, backColor, ...options } =
    readCardPrint(settings);
  const changed = Object.entries(options).some(
    ([key, value]) => value !== CARD_PRINT_DEFAULTS[key],
  );
  const hasStyles = Object.keys(cardStyles).length > 0;
  return changed || Object.keys(fontSizes).length || hasStyles || backColor
    ? {
        ...options,
        fontSizes,
        ...(hasStyles && { cardStyles }),
        ...(backColor && { backColor }),
      }
    : undefined;
}

export function cardPrintStyle(settings, worksheetId, card) {
  const key = cardFontKey(worksheetId, card.id);
  const style = settings.cardStyles?.[key];
  return {
    body: settings.fontSizes?.[key] ?? CARD_PRINT_FONT,
    title: style?.title ?? CARD_PRINT_SIZES.title.default,
    type: style?.type ?? CARD_PRINT_SIZES.type.default,
    color: style?.color || card.color,
  };
}
