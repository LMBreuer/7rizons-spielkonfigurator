import assert from "node:assert/strict";
import { test } from "node:test";
import {
  exportCardFile,
  importCardFile,
  parseCardFile,
} from "../src/card-exchange.js";
import { parseCardMarkdown } from "../src/card-editor-format.js";
import { translate } from "../supabase/functions/_shared/translations.js";
import { cardTextSections } from "../supabase/functions/_shared/card-text.js";
import {
  cardFontKey,
  readCardPrint,
  savedCardPrint,
} from "../supabase/functions/_shared/card-print.js";
import {
  newDraft,
  createWorksheet,
  readSnapshot,
  templateResult,
} from "../supabase/functions/_shared/domain.js";

test("a card deck round-trips types, Markdown, notes, card colors and print settings", () => {
  const draft = {
    ...newDraft(),
    learning: ["per"],
    mechanisms: ["m91", "m72"],
  };
  const result = templateResult(draft, undefined, "guided");
  const card = {
    id: crypto.randomUUID(),
    mechanismId: "m72",
    title: "Zwei Seiten",
    group: "beziehungen",
    text: parseCardMarkdown(
      "## Situation\n\n**Beispiel**\n\n---\n\n## Anweisung",
    ).toJSON(),
    color: "#2a6fb4",
    notes: ["Rückfrage"],
  };
  result.cards = [card];
  result.cardTypes = { m72: "Rollenkarte" };
  const worksheet = createWorksheet({
    draft,
    result,
    source: { kind: "template" },
  });
  const key = cardFontKey(worksheet.id, card.id);
  const backText = parseCardMarkdown("## Workshop\n\n**Rückseite**").toJSON();
  const settings = readCardPrint({
    paper: "cream",
    design: "retro",
    backColor: "#c84b50",
    backText,
    fontSizes: { [key]: 11 },
    cardStyles: { [key]: { title: 19, type: 7.5, color: "#7f598b" } },
  });
  const snapshot = readSnapshot({
    draft,
    worksheets: [worksheet],
    cardPrint: savedCardPrint(settings),
  });
  assert.deepEqual(snapshot.worksheets[0].result.cardTypes, result.cardTypes);
  assert.equal(snapshot.worksheets[0].result.cards[0].group, "beziehungen");
  assert.deepEqual(snapshot.cardPrint.backText, backText);
  const ctx = {
    result,
    worksheetId: worksheet.id,
    settings,
    typeName: () => "Rollenkarte",
    t: (text) => translate(text, "en"),
  };
  const exported = exportCardFile(ctx);
  assert.match(exported.cards[0].textMarkdown, /\n---\n/);
  const target = { ...result, cards: [], cardTypes: {} };
  const imported = importCardFile(
    exported,
    target,
    worksheet.id,
    readCardPrint(),
  );
  assert.deepEqual(imported.added, [card]);
  assert.deepEqual(imported.types, result.cardTypes);
  assert.deepEqual(imported.settings, settings);
  assert.equal(
    importCardFile(exported, result, worksheet.id, settings).skipped,
    1,
  );
  const changed = {
    ...exported,
    cards: [{ ...exported.cards[0], title: "Andere Karte" }],
  };
  const copy = importCardFile(changed, result, worksheet.id, settings);
  assert.notEqual(copy.added[0].id, card.id);
  assert.equal(copy.added[0].title, "Andere Karte");
  const template = exportCardFile({ ...ctx, template: true });
  assert.ok(template.availableGroups.some(({ group }) => group === "einstieg"));
  assert.equal(template.cards[0].id, undefined);
  assert.equal(template.cards[0].textMarkdown, "Description");
  assert.equal(template.cards[0].instructionMarkdown, "Workshop task");
  assert.equal(template.settings.backTextMarkdown, undefined);
  assert.ok(template.format.design.includes("retro"));
  assert.equal(template.format.fontSizePt.title.max, 26);
  const fromTemplate = importCardFile(template, target, worksheet.id, settings);
  assert.ok(fromTemplate.added[0].id);
  assert.deepEqual(
    fromTemplate.added[0].instruction,
    parseCardMarkdown(template.cards[0].instructionMarkdown).toJSON(),
  );
  assert.deepEqual(fromTemplate.settings.backText, backText);
  assert.throws(
    () =>
      importCardFile(
        {
          ...exported,
          cards: [
            ...exported.cards,
            { ...card, id: crypto.randomUUID(), mechanismId: "unknown" },
          ],
        },
        result,
        worksheet.id,
        settings,
      ),
    /mechanismId/,
  );
  assert.deepEqual(result.cards, [card]);
});

test("card sections preserve explicit instructions and read legacy dividers", () => {
  const introduction = parseCardMarkdown(
    "Einleitung\n\n---\n\nZusatz",
  ).toJSON();
  const instruction = parseCardMarkdown(
    "Wähle **eine andere Person**.",
  ).toJSON();
  const card = {
    id: crypto.randomUUID(),
    mechanismId: "m72",
    title: "",
    text: introduction,
    instruction,
    color: "#2a6fb4",
    notes: [],
  };
  const worksheetId = crypto.randomUUID();
  const result = { mechanisms: [{ mechanismId: "m72" }], cards: [card] };
  const settings = readCardPrint();
  const exported = exportCardFile({
    result,
    worksheetId,
    settings,
    typeName: () => "Rolle",
  });
  assert.deepEqual(
    importCardFile(exported, { ...result, cards: [] }, worksheetId, settings)
      .added,
    [card],
  );
  assert.equal(
    importCardFile(exported, result, worksheetId, settings).skipped,
    1,
  );
  assert.deepEqual(cardTextSections(card), { introduction, instruction });
  assert.deepEqual(
    cardTextSections({ text: "Erzähl weiter.\n\n---\n\nFrag die Gruppe." }),
    {
      introduction: "Erzähl weiter.",
      instruction: "Frag die Gruppe.",
    },
  );
  assert.deepEqual(
    cardTextSections({
      text: parseCardMarkdown("Einleitung\n\n---\n\n*Auftrag*").toJSON(),
    }),
    {
      introduction: parseCardMarkdown("Einleitung").toJSON(),
      instruction: parseCardMarkdown("*Auftrag*").toJSON(),
    },
  );
});

test("a batch file can contain plain JSON or an AI Markdown fence", () => {
  const cards = Array.from({ length: 24 }, (_, i) => ({
    title: "Card " + (i + 1),
    mechanismId: "m72",
    textMarkdown: "## Situation\n\n**Prompt**\n\n---\n\n## Task",
    color: "#7f598b",
  }));
  const result = { mechanisms: [{ mechanismId: "m72" }], cards: [] };
  const id = crypto.randomUUID();
  const settings = readCardPrint({ design: "curve" });
  const file = JSON.stringify({
    kind: "7rizons-cards",
    schemaVersion: 1,
    cards,
  });
  for (const value of [file, "```json\r\n" + file + "\r\n```"]) {
    const batch = importCardFile(parseCardFile(value), result, id, settings);
    assert.equal(batch.added.length, 24);
    assert.equal(new Set(batch.added.map((card) => card.id)).size, 24);
    assert.equal(batch.added[0].text.content[2].type, "horizontal_rule");
    assert.equal(batch.settings.design, "curve");
  }
  assert.throws(() => parseCardFile("not JSON"), /kein gültiges JSON/);
});
