export const CARD_GROUPS = {
  anleitung: { label: "Anleitung", color: "#414345" },
  inspiration: { label: "Inspirationen", color: "#b08f23" },
  spielplan: { label: "Spielplan", color: "#555656" },
  einstieg: { label: "Einstieg", color: "#7f598b" },
  weltenbau: { label: "Weltenbau", color: "#2a6fb4" },
  handlung: { label: "Handlung", color: "#7f598b" },
  beziehungen: { label: "Beziehungen", color: "#1cb291" },
  konflikte: { label: "Konflikte", color: "#c84b50" },
  abschluss: { label: "Abschluss", color: "#7f598b" },
};

const groupForMechanic = {
  m12: "weltenbau",
  m13: "beziehungen",
  m14: "konflikte",
  m15: "handlung",
  m21: "inspiration",
  m22: "inspiration",
  m23: "inspiration",
  m31: "spielplan",
  m32: "spielplan",
  m33: "spielplan",
  m41: "einstieg",
  m42: "abschluss",
  m51: "spielplan",
};

export function isCardGroup(value) {
  return typeof value === "string" && Object.hasOwn(CARD_GROUPS, value);
}

export function cardGroup(card) {
  if (isCardGroup(card.group)) return card.group;
  return Object.hasOwn(groupForMechanic, card.mechanismId)
    ? groupForMechanic[card.mechanismId]
    : "anleitung";
}
