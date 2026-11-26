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

export async function projectFingerprint(payload) {
  const { draft, worksheets, pendingRequest, cardPrint } =
    readSnapshot(payload);
  const { id, ...draftContent } = draft;
  const snapshot = {
    draft: draftContent,
    ...(cardPrint ? { cardPrint } : {}),
    worksheets: worksheets.map((sheet) => {
      if (sheet.source?.kind !== "template") return sheet;
      // Template restore rebuilds the generated result, including a transient request ID.
      const { requestId, ...result } = sheet.result;
      return { ...sheet, result };
    }),
    pendingRequest: pendingRequest
      ? { ...pendingRequest, configurationId: undefined }
      : null,
  };
  const canonical = JSON.stringify(snapshot, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, value[key]]),
        )
      : value,
  );
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
