import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importDecision,
  nextExchange,
  projectFingerprint,
  readExchange,
} from "../src/project-exchange.js";
import {
  createWorksheet,
  newDraft,
  readSnapshot,
  templateResult,
} from "../supabase/functions/_shared/domain.js";

test("project export lineage supports repeat imports, round trips and divergent edits", async () => {
  const draft = { ...newDraft(), learning: ["per"] };
  const makeSheet = () =>
    createWorksheet({
      draft,
      result: templateResult(draft),
      source: { kind: "template" },
    });
  const sheet = makeSheet();
  const initial = { draft, worksheets: [sheet], activeWorksheetId: sheet.id };
  const first = nextExchange(draft.id, null);
  const restored = readSnapshot(JSON.parse(JSON.stringify(initial)));
  assert.equal(restored.draft.id, draft.id);
  assert.equal(restored.worksheets[0].id, sheet.id);
  const local = {
    ...initial,
    exchange: first,
    exchangeBase: await projectFingerprint(initial),
  };
  assert.equal(await projectFingerprint(restored), local.exchangeBase);
  const secondSheet = makeSheet();
  const edited = { ...restored, worksheets: [sheet, secondSheet] };
  const second = readExchange(nextExchange(draft.id, first));
  const returnedFingerprint = await projectFingerprint(edited);
  assert.equal(second.projectId, draft.id);
  assert.notEqual(second.exportId, first.exportId);
  assert.deepEqual(second.ancestors, [first.exportId]);
  assert.equal(
    importDecision(local, second, local.exchangeBase, returnedFingerprint),
    "update",
  );
  const divergent = await projectFingerprint({
    ...initial,
    draft: {
      ...draft,
      context: { ...draft.context, thema: "Lokale Änderung" },
    },
  });
  assert.equal(
    importDecision(local, second, divergent, returnedFingerprint),
    "conflict",
  );
  assert.equal(
    importDecision(local, first, divergent, local.exchangeBase),
    "open",
  );
  const copy = { ...edited, draft: { ...draft, id: crypto.randomUUID() } };
  assert.equal(await projectFingerprint(copy), returnedFingerprint);
});

test("card print settings travel with a project and defaults preserve existing fingerprints", async () => {
  const original = { draft: newDraft() };
  const print = {
    orientation: "landscape",
    design: "retro",
    paper: "cream",
    back: "image",
    backImage: "data:image/webp;base64,AA==",
    backText: "Workshop",
    includeBacks: false,
    fontSizes: { [crypto.randomUUID() + ":" + crypto.randomUUID()]: 12 },
  };
  const customized = { ...original, cardPrint: print };
  const restored = readSnapshot(JSON.parse(JSON.stringify(customized)));
  assert.deepEqual(restored.cardPrint, print);
  assert.equal(
    await projectFingerprint(restored),
    await projectFingerprint(customized),
  );
  assert.notEqual(
    await projectFingerprint(customized),
    await projectFingerprint(original),
  );
  const invalid = {
    ...original,
    cardPrint: {
      design: "<html>",
      back: "image",
      backImage: "https://example.com/card.svg",
      fontSizes: { bogus: 100 },
    },
  };
  assert.equal(readSnapshot(invalid).cardPrint, undefined);
  assert.equal(
    await projectFingerprint(invalid),
    await projectFingerprint(original),
  );
});
