import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { PNG } from "pngjs";
import { initialAppearance, APPEARANCE_KEY } from "../src/appearance.js";

test("light is default, only an explicit new appearance preference is restored", () => {
  assert.equal(initialAppearance({ getItem: () => null }), "light");
  assert.equal(initialAppearance({ getItem: () => "unexpected" }), "light");
  assert.equal(
    initialAppearance({
      getItem() {
        throw new Error("blocked");
      },
    }),
    "light",
  );
  for (const theme of ["light", "dark", "contrast"])
    assert.equal(
      initialAppearance({
        getItem: (key) => (key === APPEARANCE_KEY ? theme : null),
      }),
      theme,
    );
});
test("original logo has alpha transparency and favicon embeds the unchanged source symbol", async () => {
  const bytes = await readFile(
    new URL("../src/assets/7rizons-logo.png", import.meta.url),
  );
  const png = PNG.sync.read(bytes);
  assert.equal(png.data[3], 0);
  const favicon = await readFile(
    new URL("../public/favicon.svg", import.meta.url),
    "utf8",
  );
  assert.match(favicon, /viewBox="568 213 775 759"/);
  assert.deepEqual(
    Buffer.from(favicon.match(/base64,([^\"]+)/)[1], "base64"),
    bytes,
  );
});
function luminance(hex) {
  hex = hex.slice(1);
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  return hex
    .match(/../g)
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
test("text palette pairs meet 4.5:1, and high contrast pairs meet 7:1", async () => {
  const css = await readFile(
    new URL("../src/style.css", import.meta.url),
    "utf8",
  );
  for (const mode of ["light", "dark", "contrast"]) {
    const selector = mode === "light" ? ":root" : `:root[data-theme="${mode}"]`;
    const body = css
      .slice(css.indexOf(selector) + selector.length)
      .match(/\{([^}]+)\}/)[1];
    const vars = Object.fromEntries(
      [...body.matchAll(/--([\w-]+):\s*(#[\da-f]+)/gi)].map((m) => [
        m[1],
        m[2],
      ]),
    );
    for (const [foreground, background] of [
      ["ink", "surface"],
      ["muted", "surface"],
      ["muted", "surface2"],
      ["blue", "blue-light"],
      ["purple", "purple-light"],
      ["teal", "surface"],
      ["red", "red-light"],
    ]) {
      const a = luminance(vars[foreground]),
        b = luminance(vars[background]),
        ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(
        ratio >= (mode === "contrast" ? 7 : 4.5),
        `${mode} ${foreground}/${background}: ${ratio}`,
      );
    }
  }
});
test("semantic audit, keyboard navigation, live sorting feedback and forms across all three appearances", async () => {
  const dom = new JSDOM(
    '<!doctype html><html lang="de"><head><title>Test</title><meta name="theme-color" content="#fff"></head><body></body></html>',
    { url: "https://example.test/" },
  );
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    localStorage: dom.window.localStorage,
    MutationObserver: dom.window.MutationObserver,
  }))
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.scrollTo = () => {};
  // JSDOM has no pixel renderer; colours are measured separately above.
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  dom.window.confirm = () => true;
  const temp = resolve("tests", `.a11y-${process.pid}.mjs`);
  let cleanup;
  try {
    const bundled = await build({
      entryPoints: ["src/App.jsx"],
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      write: false,
      loader: { ".png": "dataurl" },
      define: {
        "import.meta.env.VITE_SUPABASE_URL": "undefined",
        "import.meta.env.VITE_SUPABASE_ANON_KEY": "undefined",
      },
    });
    await writeFile(temp, bundled.outputFiles[0].contents);
    const React = await import("react");
    const testing = await import("@testing-library/react");
    const { render, screen, within, waitFor } = testing;
    cleanup = testing.cleanup;
    const user = (await import("@testing-library/user-event")).default.setup({
      document: dom.window.document,
    });
    const axe = (await import("axe-core")).default;
    const App = (await import(pathToFileURL(temp).href)).default;
    render(React.createElement(App));
    const audit = async (label) => {
      const r = await axe.run(dom.window.document, {
        rules: { "color-contrast": { enabled: false } },
      });
      assert.deepEqual(
        r.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        label,
      );
    };
    const appearances = within(
      screen.getByRole("group", { name: "Darstellung" }),
    );
    assert.equal(
      appearances
        .getByRole("button", { name: "Hell", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await user.tab();
    assert.equal(document.activeElement.textContent, "Zum Inhalt springen");
    await user.keyboard("{Enter}");
    assert.equal(document.activeElement.id, "main-content");
    assert.equal(screen.getByLabelText("Datum").type, "date");
    assert.equal(screen.getByLabelText("Semester").tagName, "SELECT");
    await audit("context");
    const step = async (name) =>
      user.click(
        within(
          screen.getByRole("navigation", { name: "Konfigurationsschritte" }),
        ).getByRole("button", { name: new RegExp(name) }),
      );
    await step("Lerntätigkeiten");
    assert.equal(
      document.activeElement.textContent,
      "Schritt 2: Lernerlebnisse wählen",
    );
    await user.click(
      screen.getByRole("button", { name: "Perspektive einnehmen" }),
    );
    assert.equal(
      screen
        .getByRole("button", { name: "Perspektive einnehmen" })
        .getAttribute("aria-pressed"),
      "true",
    );
    await audit("learning");
    await step("Mechaniken");
    await audit("mechanisms");
    await step("Übersicht");
    const handle = screen.getByRole("button", {
      name: "Zweiteilige Kartenstruktur zum Sortieren ziehen",
    });
    handle.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      assert.match(
        screen.getByRole("status").textContent,
        /Zweiteilige Kartenstruktur: Position 3/,
      ),
    );
    assert.ok(
      document.activeElement === handle,
      "keyboard sorting retains focus",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Zweiteilige Kartenstruktur entfernen",
      }),
    );
    await waitFor(() =>
      assert.match(screen.getByRole("status").textContent, /wurde entfernt/),
    );
    assert.ok(document.activeElement.classList.contains("drag-handle"));
    await audit("priorities");
    await step("Arbeitsblatt");
    assert.equal(
      within(
        screen.getByRole("group", { name: "Weg zum Arbeitsblatt" }),
      ).queryByRole("button", { name: "Mit Workshop-KI" }),
      null,
    );
    for (const theme of ["light", "dark", "contrast"]) {
      await user.click(
        appearances.getByRole("button", {
          name: { light: "Hell", dark: "Dunkel", contrast: "Hoher Kontrast" }[
            theme
          ],
          exact: true,
        }),
      );
      assert.equal(document.documentElement.dataset.theme, theme);
      assert.equal(localStorage.getItem(APPEARANCE_KEY), theme);
      await audit(`worksheet modes: ${theme}`);
    }
    await user.click(
      screen.getByRole("button", { name: "Arbeitsblatt erstellen" }),
    );
    await waitFor(() =>
      assert.match(document.activeElement.textContent, /7’rizons Seminar-Hack/),
    );
    await audit("generated worksheet");
    await user.click(screen.getByRole("button", { name: "Anmelden" }));
    assert.equal(screen.getByLabelText("E-Mail").type, "email");
    assert.equal(
      screen.getByRole("button", { name: "Magic Link senden" }).type,
      "submit",
    );
    await user.click(
      screen.getByRole("button", { name: "Administrationszugang" }),
    );
    assert.equal(screen.getByLabelText("Passwort").type, "password");
    await audit("account");
    await user.click(screen.getByRole("contentinfo").querySelector("button"));
    assert.equal(
      document.activeElement.textContent,
      "Über den Spielkonfigurator",
    );
    await audit("about");
  } finally {
    cleanup?.();
    await unlink(temp).catch(() => {});
    dom.window.close();
  }
});
