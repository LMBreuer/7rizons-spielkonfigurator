import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import en from "../supabase/functions/_shared/locales/en.json" with { type: "json" };
import { translate } from "../supabase/functions/_shared/translations.js";
import { LE, MK } from "../supabase/functions/_shared/catalog.js";
import {
  newDraft,
  templateResult,
  markdown,
  requestFor,
  makePrompt,
} from "../supabase/functions/_shared/domain.js";

test("English dictionary covers the complete catalogue and keeps interpolation/data separate", () => {
  for (const item of [...LE, ...MK])
    for (const key of [
      "label",
      "desc",
      "kurz",
      "kat",
      "bloom",
      "fuer",
      "hinweis",
    ])
      if (item[key])
        assert.ok(Object.hasOwn(en, item[key]), `${item.id}.${key}`);
  assert.equal(
    translate("Arbeitsblatt {0} löschen", "en", { 0: 4 }),
    "Delete worksheet 4",
  );
  assert.equal(
    translate("Arbeitsblatt {0} löschen", "de", { 0: 4 }),
    "Arbeitsblatt 4 löschen",
  );
  assert.equal(
    translate("Topic entered by a participant", "en"),
    "Topic entered by a participant",
  );
});
test("English no-AI output, Markdown and AI request preserve language and topic", () => {
  const d = {
    ...newDraft(),
    language: "en",
    learning: ["per"],
    mechanisms: ["m91", "m72"],
    context: { thema: "Unverändertes Thema" },
  };
  const result = templateResult(d),
    md = markdown(d, result);
  assert.match(result.title, /Unverändertes Thema/);
  assert.match(result.introduction, /This worksheet/);
  assert.match(result.mechanisms[0].adaptation, /Keywords define/);
  assert.match(md, /## New mechanics/);
  assert.match(md, /## Safety framework/);
  assert.match(md, /Your own card/);
  assert.equal(requestFor(d).language, "en");
  const prompt = makePrompt(requestFor(d));
  assert.match(prompt, /Produce a complete worksheet in English/);
  assert.doesNotMatch(prompt, /Erstelle eine vollständige/);
  assert.match(prompt, /Perspective roles/);
});
test("all explicitly translated literal UI strings have an English entry", async () => {
  for (const file of [
    "src/App.jsx",
    "src/ProjectModeration.jsx",
    "src/Priority.jsx",
    "src/AppearanceSwitch.jsx",
    "src/ContextField.jsx",
    "src/Worksheet.jsx",
  ]) {
    const source = await readFile(
      new URL("../" + file, import.meta.url),
      "utf8",
    );
    for (const m of source.matchAll(
      /\bt\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    )) {
      const value = m[1][0] === '"' ? JSON.parse(m[1]) : m[1].slice(1, -1);
      assert.ok(
        Object.hasOwn(en, value.trim().replace(/\s+/g, " ")),
        `${file}: ${value}`,
      );
    }
  }
});
