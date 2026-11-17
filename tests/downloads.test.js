import {test} from "node:test";
import assert from "node:assert/strict";
import {jsonFilename} from "../src/downloads.js";
test("JSON downloads include a safe topic and Vienna timestamp, including without a topic", () => {
  const now = new Date("2026-11-17T15:04:05Z");
  assert.equal(jsonFilename("Klimagerechtigkeit", "konfiguration", now), "7rizons-konfiguration_klimagerechtigkeit_2026-11-17_16-04-05.json");
  assert.equal(jsonFilename("", "konfiguration", now), "7rizons-konfiguration_2026-11-17_16-04-05.json");
  assert.equal(jsonFilename("  Städte / Höfe: ../?*  ", "abgabe", now), "7rizons-abgabe_städte-höfe_2026-11-17_16-04-05.json");
  assert.equal(jsonFilename(" ", "abgabe", new Date("2026-11-17T23:00:00Z")), "7rizons-abgabe_2026-11-18_00-00-00.json");
  assert.ok(jsonFilename("Thema".repeat(100), "konfiguration", now).length < 120);
});
