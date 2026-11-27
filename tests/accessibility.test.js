import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { newDraft } from "../supabase/functions/_shared/domain.js";
import { semesterOptions } from "../supabase/functions/_shared/fields.js";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { PNG } from "pngjs";
import {
  initialAppearance,
  APPEARANCE_KEY,
  initialLayout,
  LAYOUT_KEY,
} from "../src/appearance.js";

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
test("the new layout is default and the saved classic layout restores", () => {
  assert.equal(initialLayout({ getItem: () => null }), "modern");
  assert.equal(
    initialLayout({
      getItem: (key) => (key === LAYOUT_KEY ? "classic" : null),
    }),
    "classic",
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
    {
      url: "https://example.test/?modus=selbststudium",
      pretendToBeVisual: true,
    },
  );
  for (const [key, value] of Object.entries({
    window: dom.window,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
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
  const stylesheet = dom.window.document.createElement("style");
  stylesheet.textContent = await readFile(
    new URL("../src/style.css", import.meta.url),
    "utf8",
  );
  stylesheet.textContent += await readFile(
    new URL("../src/layout.css", import.meta.url),
    "utf8",
  );
  dom.window.document.head.append(stylesheet);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.scrollTo = () => {};
  dom.window.Range.prototype.getClientRects = () => [];
  dom.window.Range.prototype.getBoundingClientRect = () =>
    new dom.window.DOMRect();
  dom.window.document.elementFromPoint = () => null;
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
    const legacy = newDraft();
    localStorage.setItem("7rizons:draft:v1", JSON.stringify({ draft: legacy }));
    render(React.createElement(App));
    assert.equal(localStorage.getItem("7rizons:active-project"), legacy.id);
    assert.ok(localStorage.getItem("7rizons:project:v1:" + legacy.id));
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
    const openPreferences = async () => {
      const preferences = document.querySelector(".preferences-menu");
      if (!preferences.open)
        await user.click(preferences.querySelector("summary"));
    };
    await user.tab();
    assert.equal(
      document.activeElement.textContent.trim(),
      "Zum Inhalt springen",
    );
    await user.keyboard("{Enter}");
    assert.equal(document.activeElement.id, "main-content");
    await openPreferences();
    const appearances = within(
      screen.getByRole("group", { name: "Darstellung" }),
    );
    assert.equal(
      appearances
        .getByRole("button", { name: "Hell", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await user.keyboard("{Escape}");
    assert.equal(screen.getByLabelText("Datum").type, "date");
    assert.equal(screen.getByLabelText("Semester").tagName, "SELECT");
    const semester = screen.getByLabelText("Semester", { exact: true });
    assert.equal(semester.value, semesterOptions()[0]);
    assert.doesNotMatch(semester.textContent, /z\. B\./);
    await user.selectOptions(semester, "custom");
    await user.type(
      screen.getByLabelText("Anderes Semester", { exact: true }),
      "WS 2024/25",
    );
    assert.equal(screen.getByLabelText("Datum").type, "date");
    await audit("context with custom semester");
    await user.selectOptions(semester, "");
    assert.equal(
      screen.queryByLabelText("Anderes Semester", { exact: true }),
      null,
    );
    await user.type(
      screen.getByLabelText(/Thema des Seminars/),
      "Navigationstest",
    );
    await audit("context");
    const step = async (name) =>
      user.click(
        within(
          screen.getByRole("navigation", { name: "Konfigurationsschritte" }),
        ).getByRole("button", { name: new RegExp(name) }),
      );
    await step("Lernerlebnisse");
    assert.equal(
      document.activeElement.textContent.trim(),
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
    await user.selectOptions(
      screen.getByLabelText("Direkt zu einem Schritt springen"),
      "1",
    );
    assert.equal(
      screen.getByLabelText(/Thema des Seminars/).value,
      "Navigationstest",
    );
    await user.selectOptions(
      screen.getByLabelText("Direkt zu einem Schritt springen"),
      "2",
    );
    assert.equal(
      screen
        .getByRole("button", { name: "Perspektive einnehmen" })
        .getAttribute("aria-pressed"),
      "true",
    );
    await step("Mechaniken");
    await audit("mechanisms");
    await user.click(
      screen.getByRole("button", {
        name: /Perspektivrollen \(ohne Vollcharakter\)/,
      }),
    );
    await step("Übersicht");
    assert.ok(screen.getByRole("heading", { name: "Im Basisspiel vorhanden" }));
    const baseCheckbox = screen.getByRole("checkbox", {
      name: /Zweiteilige Kartenstruktur/,
    });
    assert.equal(dom.window.getComputedStyle(baseCheckbox).width, "18px");
    assert.equal(
      parseFloat(dom.window.getComputedStyle(baseCheckbox).minHeight),
      0,
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Zweiteilige Kartenstruktur/ }),
    );
    assert.ok(
      !document.activeElement.matches(".drag-handle"),
      "promoting a mechanic keeps focus in the base-game section",
    );
    const handle = screen.getByRole("button", {
      name: "Zweiteilige Kartenstruktur – Priorität ändern",
    });
    handle.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      assert.match(
        screen.getByRole("status").textContent,
        /Zweiteilige Kartenstruktur: Position 2/,
      ),
    );
    assert.ok(
      document.activeElement === handle,
      "keyboard sorting retains focus",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /Zweiteilige Kartenstruktur/,
      }),
    );
    await waitFor(() =>
      assert.ok(
        screen.getByRole("checkbox", { name: /Zweiteilige Kartenstruktur/ })
          .checked === false,
      ),
    );
    assert.ok(document.activeElement.type === "checkbox");
    await audit("priorities");
    await step("Arbeitsblatt");
    assert.equal(
      within(
        screen.getByRole("group", { name: "Weg zum Arbeitsblatt" }),
      ).queryByRole("button", { name: "Mit Workshop-KI" }),
      null,
    );
    for (const theme of ["light", "dark", "contrast"]) {
      await openPreferences();
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
      assert.match(
        document.activeElement.textContent.trim(),
        /7’rizons Seminar-Hack/,
      ),
    );
    let printCalls = 0;
    dom.window.print = () => {
      printCalls += 1;
    };
    await user.click(
      screen.getByRole("button", { name: "Arbeitsblatt drucken", exact: true }),
    );
    assert.equal(printCalls, 1);
    await audit("generated worksheet");
    assert.equal(
      screen.queryByRole("checkbox", { name: "Arbeitsaufträge ergänzen" }),
      null,
    );
    const example = screen
      .getAllByText("Ausgefülltes Beispiel anzeigen")[0]
      .closest("details");
    assert.equal(example.open, false);
    await user.click(example.querySelector("summary"));
    assert.equal(example.open, true);
    assert.ok(example.classList.contains("no-print"));
    const openSheets = async () => {
      const menu = document.querySelector(".sheet-menu");
      if (!menu.open) await user.click(menu.querySelector("summary"));
    };
    const newSheet = async () => {
      await openSheets();
      await user.click(
        screen.getByRole("button", { name: /Neues Blatt|New worksheet/ }),
      );
    };
    await openSheets();
    const collection = () =>
      within(
        screen.getByRole("group", { name: "Gespeicherte Arbeitsblätter" }),
      );
    await openSheets();
    assert.equal(
      collection().getAllByRole("button", { name: /löschen/ }).length,
      1,
    );
    await newSheet();
    const instructionChoice = screen.getByRole("checkbox", {
      name: "Arbeitsaufträge ergänzen",
    });
    assert.equal(instructionChoice.checked, true);
    await user.click(instructionChoice);
    await user.click(
      screen.getByRole("button", {
        name: "Arbeitsblatt hinzufügen",
        exact: true,
      }),
    );
    assert.ok(
      screen.getByRole("article").classList.contains("worksheet-overview"),
    );
    assert.equal(screen.queryByText("Ausgefülltes Beispiel anzeigen"), null);
    await openSheets();
    await openSheets();
    assert.equal(
      collection().getAllByRole("button", { name: /löschen/ }).length,
      2,
    );
    await newSheet();
    await user.click(
      screen.getByRole("checkbox", { name: "Arbeitsaufträge ergänzen" }),
    );
    await user.click(screen.getByRole("button", { name: /Mit Ihrer KI-App/ }));
    assert.equal(
      screen.queryByRole("checkbox", { name: "Arbeitsaufträge ergänzen" }),
      null,
    );
    await user.click(
      screen.getByRole("button", { name: "KI-Auftrag vorbereiten" }),
    );
    const key =
      "7rizons:project:v1:" + localStorage.getItem("7rizons:active-project");
    const pending = JSON.parse(localStorage.getItem(key)).pendingRequest;
    await openSheets();
    assert.equal(
      collection().getAllByRole("button", { name: /löschen/ }).length,
      2,
    );
    const answer = {
      schemaVersion: 1,
      requestId: pending.requestId,
      configurationRevision: pending.configurationRevision,
      title: "KI-Testblatt",
      introduction: "Testeinleitung",
      mechanisms: pending.mechanisms.map((m) => ({
        mechanismId: m.id,
        adaptation: "Anpassung",
        learningContribution: "Lernbeitrag",
        cardExamples: Array(pending.cardsPerMechanism).fill("Beispiel"),
      })),
      nextSteps: Array.from({ length: 9 }, (_, i) => "Erproben " + (i + 1)),
    };
    const checkAnswer = screen.getByRole("button", { name: "Antwort prüfen" });
    await user.click(checkAnswer);
    const importError = screen.getByRole("alert");
    assert.equal(importError.previousElementSibling, checkAnswer);
    assert.match(importError.textContent, /kein gültiges JSON/);
    await user.click(screen.getByLabelText("JSON-Antwort Ihrer KI"));
    await user.paste(JSON.stringify(answer));
    assert.equal(screen.queryByRole("alert"), null);
    await user.click(screen.getByRole("button", { name: "Antwort prüfen" }));
    await user.click(
      screen.getByRole("button", { name: "Vorschau übernehmen" }),
    );
    await openSheets();
    assert.equal(
      collection().getAllByRole("button", { name: /löschen/ }).length,
      3,
    );
    assert.ok(screen.getByRole("heading", { name: "KI-Testblatt" }));
    await openSheets();
    await user.click(
      collection().getByRole("button", { name: /Arbeitsblatt 1:/ }),
    );
    assert.ok(screen.getByRole("heading", { name: /7’rizons Seminar-Hack/ }));
    await openSheets();
    await user.click(
      collection().getByRole("button", { name: "Arbeitsblatt 2 löschen" }),
    );
    await openSheets();
    assert.equal(
      collection().getAllByRole("button", { name: /löschen/ }).length,
      2,
    );
    await audit("multiple worksheets");
    cleanup();
    render(React.createElement(App));
    await openSheets();
    assert.equal(
      collection().getAllByRole("button", { name: /löschen/ }).length,
      2,
    );
    await openSheets();
    await user.click(
      collection().getByRole("button", { name: /Arbeitsblatt 2:/ }),
    );
    assert.ok(screen.getByRole("heading", { name: "KI-Testblatt" }));

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
    await openPreferences();
    const layout = within(
      screen.getByRole("group", { name: "Layout des Konfigurators" }),
    );
    await user.click(
      layout.getByRole("button", { name: "Klassische Ansicht" }),
    );
    assert.equal(document.documentElement.dataset.layout, "classic");
    assert.equal(localStorage.getItem(LAYOUT_KEY), "classic");
    await audit("account");
    await user.click(layout.getByRole("button", { name: "Neue Ansicht" }));
    assert.equal(document.documentElement.dataset.layout, "modern");
    const about = within(screen.getByRole("contentinfo")).getByRole("link", {
      name: "Über das Tool",
    });
    cleanup();
    dom.window.history.replaceState(
      null,
      "",
      about.href + "&modus=selbststudium",
    );
    render(React.createElement(App));
    assert.ok(
      screen.getByRole("heading", { name: "Über den Spielkonfigurator" }),
    );
    await audit("about");
    await openPreferences();
    await user.click(screen.getByRole("button", { name: /English/ }));
    assert.equal(document.documentElement.lang, "en");
    await audit("English about");
    await user.click(
      screen.getByRole("button", { name: /Go to the game configurator/ }),
    );
    await user.click(screen.getByRole("button", { name: /Seminar details/ }));
    await user.selectOptions(
      screen.getByLabelText("Go directly to a step"),
      "1",
    );
    assert.ok(screen.getByRole("heading", { name: "Step 1: Seminar details" }));
    assert.equal(document.title, "7’rizons · Game configurator");
    await user.selectOptions(
      screen.getByLabelText("Go directly to a step"),
      "5",
    );
    await newSheet();
    await user.click(
      screen.getByRole("button", { name: "Without AI", exact: true }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add worksheet", exact: true }),
    );
    assert.ok(screen.getByRole("heading", { name: /7’rizons seminar hack/ }));
    assert.ok(
      within(screen.getByRole("article")).getByRole("heading", {
        name: "Perspective roles (without a full character)",
      }),
    );
    await audit("English worksheet");
    const savedDocs = JSON.parse(localStorage.getItem(key)).worksheets;
    assert.equal(savedDocs.at(-1).draft.language, "en");
    assert.equal(savedDocs[0].draft.language, "de");
    await openPreferences();
    await user.click(
      screen.getByRole("button", { name: "Deutsch", exact: true }),
    );
    for (const number of [3, 2, 1]) {
      await openSheets();
      await user.click(
        screen.getByRole("button", {
          name: `Arbeitsblatt ${number} löschen`,
          exact: true,
        }),
      );
    }
    assert.equal(
      screen.queryByRole("group", { name: "Gespeicherte Arbeitsblätter" }),
      null,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Arbeitsblatt erstellen",
        exact: true,
      }),
    );
    assert.ok(screen.getByRole("article"));
    const originalWorksheetId = JSON.parse(localStorage.getItem(key))
      .worksheets[0].id;
    await user.click(
      screen.getByRole("button", { name: "Arbeitsblatt bearbeiten" }),
    );
    await user.click(
      screen.getAllByRole("button", { name: /Karte hinzufügen/ })[0],
    );
    await user.type(screen.getByLabelText("Kartentitel"), "Quellenkarte");
    await user.click(
      screen.getByRole("button", { name: /^\+ Notiz zur Karte$/ }),
    );
    await user.type(screen.getByLabelText("Notiz 1"), "Notiztext");
    const answerField = (
      await within(screen.getByRole("article")).findAllByRole("textbox", {
        name: "Kartentext",
      })
    )[0];
    answerField.focus();
    await user.paste("Unsere erste Karte");
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getAllByRole("button", { name: "Fett" })[0]);
    await user.click(
      screen.getByRole("button", { name: "Bearbeitung beenden" }),
    );
    assert.ok(
      within(document.querySelector(".writing-card")).getByText(
        "Unsere erste Karte",
      ),
    );
    const sheets = JSON.parse(localStorage.getItem(key)).worksheets;
    assert.equal(sheets.length, 1);
    assert.equal(sheets[0].id, originalWorksheetId);
    assert.ok(
      JSON.stringify(sheets.at(-1).result.cards).includes("Unsere erste Karte"),
    );
    await user.click(
      screen.getByRole("button", { name: "Arbeitsblatt bearbeiten" }),
    );
    assert.equal(screen.getByLabelText("Notiz 1").value, "Notiztext");
    const cardPrintMenu = document.querySelector(".sheet-cards-menu");
    assert.ok(cardPrintMenu.closest(".worksheet-screen-header.no-print"));
    await user.click(cardPrintMenu.querySelector("summary"));
    assert.ok(screen.getByRole("button", { name: "Arbeitsblatt drucken" }));
    dom.window.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    dom.window.HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    await user.click(screen.getByRole("button", { name: "Karten drucken" }));
    assert.equal(cardPrintMenu.open, false);
    const cardStudio = within(
      screen.getByRole("dialog", { name: "Kartendruck" }),
    );
    assert.ok(
      cardStudio
        .getByRole("region", { name: "Karten im Arbeitsblatt" })
        .querySelector("button"),
    );
    assert.equal(
      cardStudio.queryByRole("textbox", { name: "Kartentext" }),
      null,
    );
    await user.selectOptions(
      cardStudio.getByLabelText("Kartendesign"),
      "future",
    );
    await user.selectOptions(cardStudio.getByLabelText("Format"), "landscape");
    assert.equal(
      JSON.parse(localStorage.getItem(key)).cardPrint.design,
      "future",
    );
    assert.equal(
      JSON.parse(localStorage.getItem(key)).cardPrint.orientation,
      "landscape",
    );
    await user.click(
      cardStudio.getByRole("button", { name: "Karten drucken" }),
    );
    assert.equal(document.documentElement.dataset.print, "cards");
    window.dispatchEvent(new window.Event("afterprint"));
    assert.equal(document.documentElement.dataset.print, undefined);
    await user.click(cardStudio.getByRole("button", { name: "Schließen" }));
    assert.equal(
      within(screen.getByRole("article")).getAllByRole("textbox", {
        name: "Kartentext",
      })[0].textContent,
      "Unsere erste Karte",
    );
    assert.ok(
      within(screen.getByRole("article"))
        .getAllByRole("textbox", { name: "Kartentext" })[0]
        .querySelector("strong"),
    );
    await user.click(screen.getByRole("button", { name: "Aufzählung" }));
    assert.ok(
      screen
        .getByRole("textbox", { name: "Kartentext" })
        .querySelector("ul li"),
    );
    await user.click(screen.getByRole("button", { name: "Rückgängig" }));
    assert.equal(
      screen.getByRole("textbox", { name: "Kartentext" }).querySelector("ul"),
      null,
    );
    await user.click(
      screen.getByRole("button", { name: "Fertig", exact: true }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Notiz zur Karte hinzufügen",
      }),
    );
    const freeNote = await screen.findByRole("textbox", {
      name: "Notiz",
      exact: true,
    });
    await user.click(freeNote);
    await user.paste("Notiz nach der Karte");
    await user.click(
      screen.getByRole("button", { name: "Fertig", exact: true }),
    );
    await user.click(
      screen.getByRole("button", { name: /Ergebnisblatt hinzufügen/ }),
    );
    await user.type(screen.getByLabelText("Gruppe oder Probelauf"), "Gruppe A");
    await user.type(screen.getByLabelText("Sterne"), "Rollenwechsel");
    await user.click(
      screen.getByRole("button", { name: "Ergebnisblatt drucken" }),
    );
    assert.equal(document.documentElement.dataset.print, "reflection");
    window.dispatchEvent(new window.Event("afterprint"));
    await openSheets();
    await user.click(screen.getByRole("button", { name: "Original anzeigen" }));
    assert.ok(screen.getByText("Original vor der ersten Bearbeitung"));
    assert.equal(document.querySelector(".writing-card"), null);
    assert.equal(document.querySelector(".reflection-sheet"), null);
    await user.click(
      screen.getByRole("button", { name: "Zurück zur Bearbeitung" }),
    );
    const completeSheet = JSON.parse(localStorage.getItem(key)).worksheets[0];
    assert.deepEqual(completeSheet.original, {});
    assert.match(
      JSON.stringify(completeSheet.result.notes),
      /Notiz nach der Karte/,
    );
    assert.equal(completeSheet.result.reflections[0].stars, "Rollenwechsel");
    await audit("worksheet with playtest report and an original version");
    const firstProject = localStorage.getItem("7rizons:active-project");
    const projectTrigger = screen.getByText("Projekte", {
      selector: "summary",
    });
    await user.click(projectTrigger);
    assert.equal(projectTrigger.parentElement.open, true);
    assert.ok(screen.getByText("Im Browser gespeichert"));
    await user.click(screen.getByRole("button", { name: "Projekte verwalten" }));
    const downloadProject = screen.getByRole("button", {
      name: "Aktuelles Projekt herunterladen",
    });
    const createUrl = URL.createObjectURL;
    const clickAnchor = dom.window.HTMLAnchorElement.prototype.click;
    let downloaded;
    let filename;
    try {
      URL.createObjectURL = (blob) => {
        downloaded = blob;
        return createUrl(blob);
      };
      dom.window.HTMLAnchorElement.prototype.click = function () {
        filename = this.download;
      };
      await user.click(downloadProject);
      assert.match(filename, /\.json$/);
      assert.equal(JSON.parse(await downloaded.text()).draft.id, firstProject);
    } finally {
      URL.createObjectURL = createUrl;
      dom.window.HTMLAnchorElement.prototype.click = clickAnchor;
    }
    await user.click(screen.getByRole("button", { name: /Neues Projekt/ }));
    const secondProject = localStorage.getItem("7rizons:active-project");
    assert.notEqual(firstProject, secondProject);
    await user.click(document.querySelector(".project-menu summary"));
    await user.click(
      screen.getByRole("button", { name: "Navigationstest", exact: true }),
    );
    assert.equal(localStorage.getItem("7rizons:active-project"), firstProject);
    assert.ok(screen.getByRole("article").querySelector(".card-answer strong"));
    assert.equal(
      JSON.parse(localStorage.getItem("7rizons:project:v1:" + secondProject))
        .worksheets.length,
      0,
    );
    await user.click(document.querySelector(".project-menu summary"));
    await user.click(screen.getByRole("button", { name: "Projekte verwalten" }));
    await audit("project management");
    await user.click(screen.getByRole("button", { name: "„Navigationstest“ löschen" }));
    assert.equal(localStorage.getItem("7rizons:project:v1:" + firstProject), null);
    assert.notEqual(localStorage.getItem("7rizons:active-project"), firstProject);
    assert.ok(localStorage.getItem("7rizons:project:v1:" + secondProject));
    await user.click(screen.getByRole("button", { name: "„Unbenanntes Projekt“ öffnen" }));
    assert.equal(localStorage.getItem("7rizons:active-project"), secondProject);
    cleanup();
    localStorage.clear();
    dom.window.history.replaceState(null, "", "/");
    render(React.createElement(App));
    await step("Arbeitsblatt");
    assert.ok(screen.getByRole("alert").textContent.includes("Seminarthema"));
    await user.type(screen.getByLabelText(/Thema des Seminars/), "Workshop");
    await step("Lernerlebnisse");
    await user.click(
      screen.getByRole("button", { name: "Erleben", exact: true }),
    );
    await step("Arbeitsblatt");
    assert.equal(
      screen.queryByRole("group", { name: "Weg zum Arbeitsblatt" }),
      null,
    );
    await user.click(
      screen.getAllByRole("button", { name: /Karte hinzufügen/ })[0],
    );
    const editors = await within(screen.getByRole("article")).findAllByRole(
      "textbox",
      { name: "Kartentext" },
    );
    await user.click(editors[0]);
    await user.paste("Workshopkarte");
    await user.type(
      screen.getByRole("textbox", { name: "Notizen zum Probelauf" }),
      "Beobachtung",
    );
    await step("Übersicht");
    await step("Arbeitsblätter");
    assert.equal(
      screen.getByRole("textbox", { name: "Notizen zum Probelauf" }).value,
      "Beobachtung",
    );
    const workshopProject = JSON.parse(
      localStorage.getItem(
        "7rizons:project:v1:" + localStorage.getItem("7rizons:active-project"),
      ),
    );
    assert.equal(workshopProject.worksheets.length, 1);
    assert.match(
      JSON.stringify(workshopProject.worksheets[0].result.cards),
      /Workshopkarte/,
    );
    await audit("interactive workshop form");
    await step("Übersicht");
    await user.click(screen.getByRole("button", { name: "KI-Optionen" }));
    const builder = within(
      screen.getByRole("group", { name: "Weg zum Arbeitsblatt" }),
    );
    assert.ok(builder.getByRole("button", { name: "Mit Ihrer KI-App" }));
    assert.ok(builder.getByRole("button", { name: "Mit eigenem API-Zugang" }));
    assert.equal(screen.queryByRole("article"), null);
    cleanup();
    render(React.createElement(App));
    assert.ok(screen.getByRole("group", { name: "Weg zum Arbeitsblatt" }));
    await user.click(screen.getByRole("button", { name: "Zurück zum Blatt" }));
    assert.equal(
      screen.getByRole("textbox", { name: "Notizen zum Probelauf" }).value,
      "Beobachtung",
    );
  } finally {
    cleanup?.();
    await unlink(temp).catch(() => {});
    dom.window.close();
  }
});
