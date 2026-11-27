import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_GROUPS } from "../supabase/functions/_shared/card-groups.js";

const root = fileURLToPath(new URL("../7'rizons Assets/", import.meta.url));
const fonts = new Map([
  ["antonia-regular", "AntoniaH3-Regular.otf"],
  ["antonia-bold", "AntoniaH3-Bold.otf"],
  ["antonia-italic", "AntoniaH3-RegularItalic.otf"],
  ["exo-2", "Exo2-VariableFont_wght.ttf"],
]);
const backs = new Map(
  Object.entries(CARD_GROUPS).map(([group, { label }]) => [
    group + ".jpg",
    (group === "inspiration" ? "Inspiration" : label) + ".jpg",
  ]),
);

export default function localCardOriginals() {
  return {
    name: "local-card-originals",
    apply: "serve",
    config: () => ({
      server: {
        fs: {
          deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/7'rizons Assets/**"],
        },
      },
    }),
    configureServer(server) {
      server.middlewares.use("/__card-originals", async (request, response, next) => {
        if (!["GET", "HEAD"].includes(request.method)) return next();
        const localSocket = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
          request.socket.remoteAddress,
        );
        const localHost = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(
          request.headers.host || "",
        );
        if (!localSocket || !localHost) {
          response.statusCode = 403;
          return response.end();
        }

        const name = (request.url || "").split("?")[0].replace(/^\//, "");
        const font = fonts.get(name);
        const back = backs.get(name);
        let file, type, size;
        try {
          if (font) {
            file = join(root, font);
            type = name === "exo-2" ? "font/ttf" : "font/otf";
          } else if (back) {
            const files = await readdir(root);
            const folder = files.find((entry) => entry.normalize("NFC") === "9 Rückseiten");
            if (folder) file = join(root, folder, back);
            type = "image/jpeg";
          }
          if (file) size = (await stat(file)).size;
        } catch {}
        if (size === undefined) {
          response.statusCode = 404;
          return response.end();
        }
        response.setHeader("Content-Type", type);
        response.setHeader("Content-Length", size);
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        if (request.method === "HEAD") return response.end();
        createReadStream(file).on("error", () => response.destroy()).pipe(response);
      });
    },
  };
}
