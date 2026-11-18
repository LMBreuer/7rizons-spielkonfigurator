import { LE, MK } from "./catalog.js";
// Same primary > supporting > catalogue-primary fallback as the original artifact.
export function assignToLearning(id, learning) {
  const m = MK.find((x) => x.id === id);
  return (
    learning.find((l) => m?.w[l] === "P") ||
    learning.find((l) => m?.w[l] === "S") ||
    LE.find((l) => m?.w[l.id] === "P")?.id ||
    learning[0] ||
    "other"
  );
}
export function priorityOf(d) {
  const selected = d.mechanisms;
  const p = d.priority || {};
  const keep = (a, ids) => [
    ...new Set([...(a || []).filter((id) => ids.includes(id)), ...ids]),
  ];
  const promoted = (p.promoted || []).filter(
    (id) =>
      selected.includes(id) &&
      MK.find((m) => m.id === id)?.basis &&
      id !== "m91",
  );
  const main = selected.filter(
    (id) =>
      id !== "m91" &&
      (!MK.find((m) => m.id === id)?.basis || promoted.includes(id)),
  );
  const mechanismOrder = keep(p.mechanismOrder, main);
  const groups = keep(p.learningOrder, [
    ...d.learning,
    ...main.map((id) => assignToLearning(id, d.learning)),
  ]);
  const finalSelection = p.finalSelection
    ? p.finalSelection.filter((id) => selected.includes(id))
    : [...selected];
  return {
    learningOrder: groups,
    mechanismOrder,
    finalSelection: [...new Set(["m91", ...finalSelection])],
    promoted,
  };
}
export function orderedMechanisms(d) {
  const p = priorityOf(d);
  const main = p.learningOrder.flatMap((l) =>
    p.mechanismOrder.filter((id) => assignToLearning(id, d.learning) === l),
  );
  return [
    "m91",
    ...main,
    ...d.mechanisms.filter((id) => id !== "m91" && !main.includes(id)),
  ].filter((id) => p.finalSelection.includes(id));
}
