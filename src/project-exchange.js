import { readSnapshot } from "../supabase/functions/_shared/domain.js";

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const isProjectId = (value) =>
  typeof value === "string" && uuidPattern.test(value);

export function readExchange(value) {
  if (
    !isProjectId(value?.projectId) ||
    !isProjectId(value.exportId) ||
    typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt))
  )
    return null;
  return {
    projectId: value.projectId,
    exportId: value.exportId,
    exportedAt: value.exportedAt,
    ancestors: Array.isArray(value.ancestors)
      ? [...new Set(value.ancestors.slice(0, 64).filter(isProjectId))].filter(
          (id) => id !== value.exportId,
        )
      : [],
  };
}

export function nextExchange(draftId, previous) {
  return {
    projectId: previous?.projectId || draftId,
    exportId: crypto.randomUUID(),
    exportedAt: new Date().toISOString(),
    ancestors: previous
      ? [previous.exportId, ...previous.ancestors].slice(0, 64)
      : [],
  };
}

export function canonicalJSON(value) {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
      : item,
  );
}

export function worksheetFingerprintData(sheet) {
  if (sheet.source?.kind !== "template") return sheet;
  // Template restoration creates a transient request ID.
  const { requestId, ...result } = sheet.result;
  return { ...sheet, result };
}

export async function projectFingerprint(payload) {
  const { draft, worksheets, pendingRequest, cardPrint } =
    readSnapshot(payload);
  const { id, ...draftContent } = draft;
  const snapshot = {
    draft: draftContent,
    ...(cardPrint ? { cardPrint } : {}),
    worksheets: worksheets.map(worksheetFingerprintData),
    pendingRequest: pendingRequest
      ? { ...pendingRequest, configurationId: undefined }
      : null,
  };
  const canonical = canonicalJSON(snapshot);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function importDecision(
  local,
  incoming,
  localFingerprint,
  incomingFingerprint,
) {
  if (
    localFingerprint === incomingFingerprint &&
    (!incoming || local.exchange?.exportId === incoming.exportId)
  )
    return "open";
  if (
    local.exchange?.exportId &&
    incoming?.ancestors.includes(local.exchange.exportId) &&
    local.exchangeBase === localFingerprint
  )
    return "update";
  if (
    incoming &&
    local.exchange?.exportId === incoming.exportId &&
    local.exchangeBase === incomingFingerprint
  )
    return "open";
  return "conflict";
}
