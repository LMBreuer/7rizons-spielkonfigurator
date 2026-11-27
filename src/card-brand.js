import { useSyncExternalStore } from "react";
import { CARD_GROUPS } from "../supabase/functions/_shared/card-groups.js";
import { BRAND_CARD_DESIGN } from "../supabase/functions/_shared/card-print.js";

export const lockCardDesign = import.meta.env?.VITE_LOCK_CARD_DESIGN === "true";

export function effectiveCardPrint(settings) {
  if (!lockCardDesign && settings.design !== BRAND_CARD_DESIGN) return settings;
  return {
    ...settings,
    design: BRAND_CARD_DESIGN,
    orientation: "landscape",
    paper: "white",
    back: "original",
  };
}

const fontFiles = [
  ["AntoniaH3-Regular.otf", "Rizons Antonia", { weight: "400" }],
  ["AntoniaH3-Medium.otf", "Rizons Antonia", { weight: "500" }],
  ["AntoniaH3-Bold.otf", "Rizons Antonia", { weight: "700" }],
  [
    "AntoniaH3-RegularItalic.otf",
    "Rizons Antonia",
    { weight: "400", style: "italic" },
  ],
  ["Exo2-VariableFont_wght.ttf", "Rizons Exo", { weight: "100 900" }],
  ["BarlowCondensed-ExtraBold.ttf", "Rizons Barlow", { weight: "800" }],
];
let pack = null;
const listeners = new Set();
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const getPack = () => pack;

export function useCardBrandPack() {
  return useSyncExternalStore(subscribe, getPack);
}

export async function loadCardBrandPack(files) {
  const fontsByName = new Map();
  const backsByName = new Map();
  for (const file of files) {
    const path = (file.webkitRelativePath || file.name).normalize("NFC");
    if (path.split("/").at(-2) === "9 Rückseiten") {
      if (file.type === "image/jpeg")
        backsByName.set(file.name.normalize("NFC"), file);
    } else if (file.size <= 1_000_000) fontsByName.set(file.name, file);
  }
  const backs = Object.entries(CARD_GROUPS).map(([group, { label }]) => [
    group,
    backsByName.get((group === "inspiration" ? "Inspiration" : label) + ".jpg"),
  ]);
  if (
    backs.some(([, file]) => !file) ||
    fontFiles.some(([name]) => !fontsByName.has(name))
  )
    throw new Error("Bitte den vollständigen Ordner „7’rizons Assets“ wählen.");
  const fonts = await Promise.all(
    fontFiles.map(async ([name, family, descriptors]) =>
      new FontFace(
        family,
        await fontsByName.get(name).arrayBuffer(),
        descriptors,
      ).load(),
    ),
  );
  const originals = Object.fromEntries(
    backs.map(([group, file]) => [group, URL.createObjectURL(file)]),
  );
  try {
    await Promise.all(
      Object.values(originals).map((url) => {
        const image = new Image();
        image.src = url;
        return image.decode();
      }),
    );
  } catch (error) {
    for (const url of Object.values(originals)) URL.revokeObjectURL(url);
    throw error;
  }
  if (pack) {
    for (const url of Object.values(pack.backs)) URL.revokeObjectURL(url);
    for (const font of pack.fonts) document.fonts.delete(font);
  }
  for (const font of fonts) document.fonts.add(font);
  pack = { backs: originals, fonts };
  for (const listener of listeners) listener();
}
