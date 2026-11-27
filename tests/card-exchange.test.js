import assert from "node:assert/strict";
import { test } from "node:test";
import { exportCardFile, importCardFile } from "../src/card-exchange.js";
import { parseCardMarkdown } from "../src/card-editor-format.js";
import { translate } from "../supabase/functions/_shared/translations.js";
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
  assert.equal(template.cards[0].id, undefined);
  assert.match(template.cards[0].textMarkdown, /\n\n---\n\n## Instruction/);
  assert.equal(template.settings.backTextMarkdown, undefined);
  const fromTemplate = importCardFile(template, target, worksheet.id, settings);
  assert.ok(fromTemplate.added[0].id);
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
