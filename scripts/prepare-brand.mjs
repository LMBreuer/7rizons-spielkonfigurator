import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
// SVG viewport over the exact original symbol: no redrawing or raster recolouring.
const original = readFileSync(
  new URL("../src/assets/7rizons-logo.png", import.meta.url),
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="568 213 775 759"><image href="data:image/png;base64,${original.toString("base64")}" width="4096" height="1186"/></svg>\n`;
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/favicon.svg", import.meta.url), svg);
