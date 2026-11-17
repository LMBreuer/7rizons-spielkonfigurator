import { test } from "node:test";
import assert from "node:assert/strict";
import {
  semesterOptions,
  dateInputValue,
  displayDate,
  reordered,
} from "../supabase/functions/_shared/fields.js";

test("semester menu includes current plus nine, across winter and year boundaries", () => {
  assert.deepEqual(
    semesterOptions(new Date("2026-11-17T12:00:00Z")).slice(0, 3),
    ["WS 2026/27", "SoSe 2027", "WS 2027/28"],
  );
  const winter = semesterOptions(new Date("2027-01-15T12:00:00Z"));
  assert.equal(winter.length, 10);
  assert.equal(new Set(winter).size, 10);
  assert.equal(winter[0], "WS 2026/27");
  assert.equal(
    semesterOptions(new Date("2027-03-31T21:59:00Z"))[0],
    "WS 2026/27",
  );
  assert.equal(
    semesterOptions(new Date("2027-03-31T22:00:00Z"))[0],
    "SoSe 2027",
  );
  assert.equal(
    semesterOptions(new Date("2027-09-30T22:00:00Z"))[0],
    "WS 2027/28",
  );
});
test("date picker preserves legacy German dates and display is timezone independent", () => {
  assert.equal(dateInputValue("14.11.2025"), "2025-11-14");
  assert.equal(dateInputValue("1.2.2026"), "2026-02-01");
  assert.equal(displayDate("2026-11-17"), "17.11.2026");
  assert.equal(dateInputValue("2028-02-29"), "2028-02-29");
  assert.equal(dateInputValue("2027-02-29"), "");
  assert.equal(dateInputValue("2026-13-01"), "");
  assert.equal(dateInputValue(""), "");
  assert.equal(displayDate("November 2025"), "November 2025");
});
test("drop positions support both directions without losing the mandatory safety entry", () => {
  const ids = ["m91", "m11", "m33", "m51"];
  assert.deepEqual(reordered(ids, "m11", "m51", true), [
    "m91",
    "m33",
    "m51",
    "m11",
  ]);
  assert.deepEqual(reordered(ids, "m51", "m11"), ["m91", "m51", "m11", "m33"]);
  assert.deepEqual(reordered(ids, "m91", "m51", true), [
    "m11",
    "m33",
    "m51",
    "m91",
  ]);
  assert.equal(reordered(ids, "m11", "m33"), ids);
  assert.equal(reordered(ids, "unknown", "m51"), ids);
  assert.equal(reordered(ids, "m11", "m11"), ids);
});
