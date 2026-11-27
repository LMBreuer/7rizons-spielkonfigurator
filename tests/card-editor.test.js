import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseCardMarkdown,
  serializeCardMarkdown,
} from "../src/card-editor-format.js";
import {
  cardMarkdown,
  validCardText,
} from "../supabase/functions/_shared/card-text.js";

test("Markdown card text round-trips with both headings, a divider and existing formatting", () => {
  const source = [
    "## Situation",
    "Jemand hat dir **etwas** _versprochen_.",
    "---",
    "### Anweisung",
    "2. Frage nach.\n3. Spielt die Szene.",
    "- Eine Rolle\n  - Eine zweite Rolle",
    "Absatz mit  \nZeilenumbruch",
  ].join("\n\n");
  const doc = parseCardMarkdown(source);
  const saved = doc.toJSON();
  assert.ok(validCardText(saved));
  assert.ok(saved.content.some((node) => node.type === "horizontal_rule"));
  assert.deepEqual(
    saved.content
      .filter((node) => node.type === "heading")
      .map((node) => node.attrs.level),
    [2, 3],
  );
  assert.ok(parseCardMarkdown(serializeCardMarkdown(doc)).eq(doc));
  assert.ok(parseCardMarkdown(cardMarkdown(saved)).eq(doc));
});

test("Card Markdown treats HTML as text and rejects invalid saved layout nodes", () => {
  const raw = '<img src="https://example.com/image.png">';
  const doc = parseCardMarkdown(raw);
  assert.equal(doc.textContent, raw);
  assert.match(cardMarkdown(doc.toJSON()), /^\\</);
  assert.ok(parseCardMarkdown(serializeCardMarkdown(doc)).eq(doc));
  assert.equal(parseCardMarkdown("a".repeat(4002)), null);
  assert.equal(
    validCardText({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 9 } }],
    }),
    false,
  );
  assert.equal(
    validCardText({
      type: "doc",
      content: [{ type: "horizontal_rule", content: [] }],
    }),
    false,
  );
});
