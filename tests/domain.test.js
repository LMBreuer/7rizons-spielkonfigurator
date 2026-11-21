import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newDraft,
  requestFor,
  makePrompt,
  parseResult,
  templateResult,
  markdown,
  conflicts,
  validateDraft,
  settingsOf,
  readSnapshot,
} from "../supabase/functions/_shared/domain.js";
import {
  providerRequest,
  providerText,
} from "../supabase/functions/_shared/providers.js";
import { seal, unseal } from "../supabase/functions/_shared/crypto.js";
const draft = () => ({
  ...newDraft(),
  learning: ["per"],
  mechanisms: ["m91", "m72"],
  context: {
    thema: "Stadt und Hof",
    fach: "Geschichte",
    dozent: "VERTRAULICHER NAME",
  },
});
const answer = (r) => ({
  schemaVersion: 1,
  requestId: r.requestId,
  configurationRevision: r.configurationRevision,
  title: "Titel",
  introduction: "Einleitung",
  mechanisms: r.mechanisms.map((m) => ({
    mechanismId: m.id,
    adaptation: "Anpassen",
    learningContribution: "Perspektivwechsel",
    cardExamples: Array(r.cardsPerMechanism).fill(
      "Erzähle aus einer anderen Perspektive.",
    ),
  })),
  nextSteps: ["Erproben."],
});
test("no-AI worksheet contains selected mechanics, safety and real writing fields", () => {
  const d = draft();
  const r = templateResult(d);
  assert.equal(r.mechanisms[0].mechanismId, "m72");
  assert.deepEqual(r.mechanisms[0].cardExamples, []);
  const md = markdown(d, r);
  assert.match(md, /Safety-Rahmen/);
  assert.match(md, /Eigene Karte 3/);
  assert.doesNotMatch(md, /KARTEN:/);
});
test("prompt includes full mechanic context but omits personal organisational data", () => {
  const p = makePrompt(requestFor(draft()));
  assert.match(p, /Perspektivrollen/);
  assert.match(p, /Stadt und Hof/);
  assert.doesNotMatch(p, /VERTRAULICHER NAME/);
});
test("import rejects incomplete, repeated, unknown and stale mechanism results", () => {
  const r = requestFor(draft());
  const a = answer(r);
  assert.equal(parseResult(JSON.stringify(a), r).mechanisms.length, 1);
  for (const bad of [
    { ...a, requestId: "old" },
    { ...a, configurationRevision: 99 },
    { ...a, mechanisms: [] },
    { ...a, mechanisms: [{ ...a.mechanisms[0], mechanismId: "m83" }] },
    { ...a, mechanisms: [a.mechanisms[0], a.mechanisms[0]] },
    { ...a, mechanisms: [{ ...a.mechanisms[0], cardExamples: ["only one"] }] },
  ])
    assert.throws(() => parseResult(bad, r));
});
test("import supports pasted JSON fence and strips unrelated fields", () => {
  const r = requestFor(draft());
  const a = { ...answer(r), apiKey: "must-not-survive", admin: true };
  assert.equal(
    parseResult("```json\n" + JSON.stringify(a) + "\n```", r).title,
    "Titel",
  );
  assert.equal(parseResult(a, r).apiKey, undefined);
  assert.throws(() => parseResult("{", r));
});
test("configuration imports rebuild request from trusted catalogue and strip credential fields", () => {
  const d = draft(),
    r = requestFor(d);
  const x = readSnapshot({
    draft: { ...d, apiKey: "SECRET" },
    request: { ...r, apiKey: "SECRET" },
    result: answer(r),
    source: { kind: "import", apiKey: "SECRET" },
    apiKey: "SECRET",
  });
  assert.ok(!JSON.stringify(x).includes("SECRET"));
  assert.throws(() =>
    readSnapshot({
      draft: d,
      request: { ...r, mechanisms: [{ id: "m83" }] },
      result: {
        ...answer(r),
        mechanisms: [{ ...answer(r).mechanisms[0], mechanismId: "m83" }],
      },
    }),
  );
});
test("conflicting final selections cannot be generated", () => {
  const d = { ...draft(), mechanisms: ["m91", "m61", "m63"] };
  assert.ok(conflicts(d).length);
  assert.throws(() => requestFor(d));
  assert.throws(() => requestFor({ ...draft(), mechanisms: ["m91", "m62"] }));
});
test("mandatory safety, known IDs, duplicates validated while all learning experiences may be selected", () => {
  assert.throws(() => validateDraft({ ...draft(), mechanisms: ["m72"] }));
  assert.throws(() => validateDraft({ ...draft(), learning: ["unknown"] }));
  assert.throws(() => validateDraft({ ...draft(), learning: ["per", "per"] }));
  assert.doesNotThrow(() =>
    validateDraft({ ...draft(), learning: ["erl", "per", "dur", "ver"] }),
  );
  assert.doesNotThrow(() =>
    validateDraft(
      { ...draft(), learning: ["erl", "per", "dur", "ver"] },
      { maxInhalt: 4 },
    ),
  );
});
test("settings bounded and unsafe model IDs removed", () => {
  const s = settingsOf({
    cardsPerMechanism: 999,
    hourlyLimit: 999,
    models: { gemini: "../../bad" },
  });
  assert.equal(s.cardsPerMechanism, 3);
  assert.equal(s.hourlyLimit, 10);
  assert.equal(s.models.gemini, "");
});
test("provider transport uses fixed HTTPS endpoints and headers, never key in URL", () => {
  for (const p of ["openai", "anthropic", "gemini"]) {
    const r = providerRequest(p, "SECRET-KEY", "test-model", "prompt");
    assert.ok(r.url.startsWith("https://"));
    assert.ok(!r.url.includes("SECRET"));
    assert.ok(!JSON.stringify(r.body).includes("SECRET"));
  }
  assert.throws(() => providerRequest("custom", "key", "model", "prompt"));
  assert.throws(() => providerRequest("gemini", "key", "../../evil", "prompt"));
});
test("provider truncation/refusal is not accepted as success", () => {
  assert.equal(
    providerText("openai", {
      status: "completed",
      output: [{ content: [{ type: "output_text", text: "{}" }] }],
    }),
    "{}",
  );
  assert.throws(() =>
    providerText("openai", { status: "incomplete", output: [] }),
  );
  assert.throws(() =>
    providerText("anthropic", { stop_reason: "max_tokens", content: [] }),
  );
  assert.throws(() =>
    providerText("gemini", { candidates: [{ finishReason: "MAX_TOKENS" }] }),
  );
});
test("central API keys encrypted with random IV; wrong key rejected", async () => {
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
    "base64",
  );
  const x = await seal("personal-secret", key),
    y = await seal("personal-secret", key);
  assert.notEqual(x.iv, y.iv);
  assert.ok(!JSON.stringify(x).includes("personal-secret"));
  assert.equal(await unseal(x, key), "personal-secret");
  await assert.rejects(() => unseal(x, Buffer.alloc(32).toString("base64")));
});

test("worksheet collections retain independent revisions, selected output and pending AI request", async () => {
  const { createWorksheet } =
    await import("../supabase/functions/_shared/domain.js");
  const d = draft();
  const first = createWorksheet({
    draft: d,
    result: templateResult(d),
    source: { kind: "template" },
  });
  const newer = {
    ...d,
    revision: d.revision + 1,
    context: { ...d.context, thema: "Neues Thema" },
  };
  const r = requestFor(newer, { cardsPerMechanism: 2 });
  const second = createWorksheet({
    draft: newer,
    result: answer(r),
    request: r,
    source: { kind: "import", apiKey: "SECRET" },
    resultSettings: { cardsPerMechanism: 2 },
  });
  const pending = requestFor(newer);
  const restored = readSnapshot(
    JSON.parse(
      JSON.stringify({
        draft: newer,
        worksheets: [first, second],
        activeWorksheetId: second.id,
        pendingRequest: pending,
      }),
    ),
  );
  assert.equal(restored.worksheets.length, 2);
  assert.equal(restored.activeWorksheetId, second.id);
  assert.equal(restored.result.title, "Titel");
  assert.equal(restored.request.requestId, r.requestId);
  assert.equal(restored.pendingRequest.requestId, pending.requestId);
  assert.equal(restored.worksheets[0].draft.context.thema, "Stadt und Hof");
  assert.equal(restored.worksheets[1].resultSettings.cardsPerMechanism, 2);
  assert.ok(!JSON.stringify(restored).includes("SECRET"));
  const oldSelected = readSnapshot({
    ...restored,
    activeWorksheetId: first.id,
  });
  assert.equal(oldSelected.result, null);
  assert.equal(oldSelected.worksheets.length, 2);
  const removed = readSnapshot({ ...restored, worksheets: [first] });
  assert.equal(removed.activeWorksheetId, first.id);
  assert.throws(() =>
    readSnapshot({ ...restored, worksheets: [first, first] }),
  );
  assert.throws(() =>
    readSnapshot({ ...restored, worksheets: [{ ...second, draft: d }] }),
  );
  const legacy = readSnapshot({
    draft: d,
    result: templateResult(d),
    source: { kind: "template" },
  });
  assert.equal(legacy.worksheets.length, 1);
  assert.equal(legacy.result.configurationRevision, d.revision);
});

test("saved template editions restore with distinct print/export content, including legacy sheets", () => {
  const d = draft();
  for (const variant of [undefined, "guided", "overview"]) {
    const result = templateResult(d, undefined, variant);
    const restored = readSnapshot(
      JSON.parse(
        JSON.stringify({ draft: d, result, source: { kind: "template" } }),
      ),
    ).result;
    assert.equal(restored.templateVariant, variant);
    const md = markdown(d, restored);
    if (variant === "guided") {
      const guide = restored.mechanisms[0].guide;
      assert.ok(md.includes(guide.questions) && md.includes(guide.frame));
      assert.ok(!md.includes(guide.example));
      assert.match(md, /Probelauf/);
    } else if (variant === "overview") {
      assert.doesNotMatch(
        md,
        /Entwurf 1|Eigene Karte|Probelauf|Beitrag zu den Lerntätigkeiten|Nächste Schritte/,
      );
      assert.match(md, /Perspektivrollen/);
    } else assert.match(md, /Eigene Karte/);
  }
});

test("working copy restores printable card answers and rejects unknown slots", () => {
  const d = draft();
  const result = templateResult(d, undefined, "guided");
  const slot = result.mechanisms[0].mechanismId + "-0";
  result.answers = { [slot]: "Karte A\nZweite Zeile" };
  const snapshot = { draft: d, result, source: { kind: "template" } };
  const restored = readSnapshot(JSON.parse(JSON.stringify(snapshot))).result;
  assert.deepEqual(restored.answers, result.answers);
  assert.ok(markdown(d, restored).includes(result.answers[slot]));
  result.answers.fremd = "Test";
  assert.throws(() => readSnapshot(snapshot), /Arbeitsblattantworten/);
});

test("formatted cards restore and export bold, italic and paragraphs", () => {
  const d = draft();
  const result = templateResult(d, undefined, "guided");
  const slot = result.mechanisms[0].mechanismId + "-0";
  const answer = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "These", marks: [{ type: "strong" }] }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Frage", marks: [{ type: "em" }] }],
      },
    ],
  };
  result.answers = { [slot]: answer };
  const snapshot = { draft: d, result, source: { kind: "template" } };
  assert.match(
    markdown(d, readSnapshot(snapshot).result),
    /\*\*These\*\*\n\n_Frage_/,
  );
  answer.content[0].content[0].marks[0].type = "unknown";
  assert.throws(() => readSnapshot(snapshot), /Arbeitsblattantworten/);
});

test("published content travels with a project, its worksheet responses and English output", () => {
  const edition = {
    learning: {
      "l-field": {
        label: "Quellen prüfen",
        desc: "Quellen beurteilen",
        en: { label: "Assess sources" },
      },
    },
    mechanics: {
      "m-field": {
        label: "Quellenkarte",
        desc: "Eine Quelle zuordnen",
        questions: "Wer hat die Quelle verfasst?",
        example: "Eine Inschrift",
        w: { "l-field": "P" },
        en: { label: "Source card", questions: "Who wrote it?" },
      },
    },
    blocks: { playtest: "Welche Quelle blieb unklar?" },
  };
  const d = {
    ...newDraft(edition),
    learning: ["l-field"],
    mechanisms: ["m91", "m-field"],
  };
  const result = templateResult(d, undefined, "guided");
  const filled = {
    ...result,
    answers: { "m-field-0": "Mein Eintrag", playtest: "Die Datierung prüfen" },
  };
  const restored = readSnapshot(
    JSON.parse(
      JSON.stringify({
        draft: d,
        result: filled,
        source: { kind: "template" },
      }),
    ),
  );
  assert.equal(
    restored.result.mechanisms[0].guide.questions,
    "Wer hat die Quelle verfasst?",
  );
  assert.equal(restored.result.nextSteps[0], "Welche Quelle blieb unklar?");
  assert.equal(restored.result.answers.playtest, filled.answers.playtest);
  assert.match(markdown(restored.draft, restored.result), /Mein Eintrag/);
  assert.match(
    markdown(restored.draft, restored.result),
    /Die Datierung prüfen/,
  );
  assert.match(
    markdown(
      { ...d, language: "en" },
      templateResult({ ...d, language: "en" }, undefined, "guided"),
    ),
    /Who wrote it\?/,
  );
  assert.throws(() => newDraft({ mechanics: { m91: { archived: true } } }));
  assert.throws(() =>
    newDraft({ mechanics: { "m-field": { label: "X", w: { missing: "P" } } } }),
  );
});
