import { defineConfig } from "vite";
import localCardOriginals from "./scripts/local-card-originals.mjs";

export default defineConfig({
  base: "./",
  build: { assetsInlineLimit: 0 },
  plugins: [localCardOriginals()],
});
