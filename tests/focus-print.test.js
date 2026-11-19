import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { trackInputMethod } from "../src/focus.js";
test("keyboard rings follow input modality while focus remains available for screen readers", () => {
  const dom = new JSDOM(
    '<!doctype html><html><body><h1 tabindex="-1">Heading</h1></body></html>',
  );
  const doc = dom.window.document,
    stop = trackInputMethod(doc);
  assert.equal(doc.documentElement.dataset.input, "pointer");
  doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab" }));
  assert.equal(doc.documentElement.dataset.input, "keyboard");
  doc.querySelector("h1").focus();
  assert.equal(doc.activeElement.tagName, "H1");
  doc.dispatchEvent(new dom.window.Event("pointerdown"));
  assert.equal(doc.documentElement.dataset.input, "pointer");
  stop();
  dom.window.close();
});
test("dedicated A4 print CSS includes page counters and protects individual writing cards", async () => {
  const css = await readFile(
    new URL("../src/print.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /@page/);
  assert.match(css, /size:\s*A4/);
  assert.match(css, /counter\(page\)/);
  assert.match(css, /counter\(pages\)/);
  assert.doesNotMatch(css, /break-before:\s*page/);
  assert.match(css, /\.writing-card\s*\{\s*break-inside:\s*avoid-page/);
  const main = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.match(main, /href="\/src\/print.css" media="print"/);
});
