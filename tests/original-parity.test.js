import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { LE, MK } from "../supabase/functions/_shared/catalog.js";
import {
  newDraft,
  requestFor,
  templateResult,
  markdown,
  readSnapshot,
} from "../supabase/functions/_shared/domain.js";
import {
  priorityOf,
  orderedMechanisms,
  assignToLearning,
} from "../supabase/functions/_shared/priority.js";
test("catalogue contains all original learning experiences and mechanics without abridgement", async () => {
  // Original is a user-owned reference, intentionally not committed. CI validates
  // the catalogue fixture; local runs additionally compare the delivered artifact.
  assert.equal(
    createHash("sha256").update(JSON.stringify({ LE, MK })).digest("hex"),
    "09a8fff0cc365606a307c0e7fc4d006b4c7a819a58879155e28f77b9043b1427",
  );
  let source;
  try {
    source = await readFile(
      new URL("../seminar-hack-tool.tsx", import.meta.url),
      "utf8",
    );
  } catch {
    return;
  }
  const extract = (name, next) =>
    Function(
      `return (${source
        .slice(
          source.indexOf("const " + name + " = ") +
            ("const " + name + " = ").length,
          source.indexOf(next, source.indexOf("const " + name + " = ")),
        )
        .trim()
        .replace(/;$/, "")})`,
    )();
  assert.deepEqual(LE, extract("LE", "const MK"));
  const original = extract("MK", "// ── PALETTE");
  assert.deepEqual(MK, original);
});
test("original priority model distinguishes candidate, base promotion, checked final selection and nested order", () => {
  const d = {
    ...newDraft(),
    learning: ["erl", "ref"],
    mechanisms: ["m91", "m11", "m51", "m21", "m63"],
  };
  let p = priorityOf(d);
  assert.deepEqual(p.mechanismOrder, ["m21", "m63"]);
  assert.equal(assignToLearning("m21", d.learning), "erl");
  p = {
    ...p,
    promoted: ["m11"],
    mechanismOrder: ["m11", "m21", "m63"],
    finalSelection: ["m91", "m51", "m21", "m63"],
  };
  const configured = { ...d, priority: p };
  assert.ok(!orderedMechanisms(configured).includes("m11"));
  assert.ok(configured.mechanisms.includes("m11"));
  const selected = {
    ...configured,
    priority: { ...p, finalSelection: [...p.finalSelection, "m11"] },
  };
  assert.deepEqual(
    requestFor(selected).mechanisms.map((m) => m.id),
    orderedMechanisms(selected).filter((id) => id !== "m91"),
  );
  const saved = readSnapshot({
    draft: selected,
    result: templateResult(selected),
    source: { kind: "template" },
  });
  assert.deepEqual(saved.draft.priority, p.priority || selected.priority);
  const md = markdown(selected, templateResult(selected));
  for (const section of [
    "Neue Mechaniken",
    "Basisspiel-Elemente gezielt nutzen",
    "Safety-Rahmen",
    "Nächste Schritte",
  ])
    assert.ok(md.includes("## " + section));
  assert.ok(
    md.indexOf("## Neue Mechaniken") <
      md.indexOf("## Basisspiel-Elemente gezielt nutzen"),
  );
});
