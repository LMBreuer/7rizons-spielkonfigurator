import { readCardPrint, savedCardPrint, cardFontKey } from "../supabase/functions/_shared/card-print.js";
import { readSnapshot } from "../supabase/functions/_shared/domain.js";
import { canonicalJSON, worksheetFingerprintData } from "./project-exchange.js";

export function syncDecision(local, remoteRevision, remoteFingerprint, localFingerprint) {
  if (localFingerprint === remoteFingerprint) return "match";
  if (local.cloudRevision === remoteRevision) {
    return local.cloudFingerprint === localFingerprint ? "load" : "save";
  }
  if (
    local.cloudRevision < remoteRevision &&
    local.cloudFingerprint === localFingerprint
  ) {
    return "load";
  }
  return "copy";
}

export function conflictCopy(record, id = crypto.randomUUID()) {
  return {
    ...record,
    draft: { ...record.draft, id },
    cloudRevision: 0,
    cloudOwner: null,
    cloudFingerprint: null,
    syncCopy: true,
    openedAt: Date.now(),
  };
}
function worksheetVersion(version) {
  const snapshot = readSnapshot(version);
  const { fontSizes, cardStyles, ...print } = readCardPrint(snapshot.cardPrint);
  const project = canonicalJSON({
    draft: snapshot.draft,
    pendingRequest: snapshot.pendingRequest,
    projectName: version.projectName || "",
    print,
  });
  const worksheets = snapshot.worksheets.map((sheet) => {
    const settingsFor = (map) => Object.fromEntries(
      Object.entries(map)
        .filter(([key]) => key.startsWith(sheet.id + ":"))
        .map(([key, value]) => [key.slice(sheet.id.length + 1), value]),
    );
    const styles = settingsFor(cardStyles);
    const fonts = settingsFor(fontSizes);
    const { id, ...content } = worksheetFingerprintData(sheet);
    return { sheet, styles, fonts, signature: canonicalJSON({ content, styles, fonts }) };
  });
  return { project, worksheets, print, fontSizes, cardStyles };
}

export function worksheetMerge(local, online) {
  // Legacy solo worksheets have no persistent ID to match across devices.
  if ((!local.worksheets && local.result) || (!online.worksheets && online.result)) return null;
  const device = worksheetVersion(local);
  const server = worksheetVersion(online);
  if (device.project !== server.project) return null;
  const byId = new Map(server.worksheets.map((entry) => [entry.sheet.id, entry]));
  const bySignature = new Map(server.worksheets.map((entry) => [entry.signature, entry]));
  const worksheets = server.worksheets.map(({ sheet }) => sheet);
  let activeWorksheetId = local.activeWorksheetId || online.activeWorksheetId;
  for (const entry of device.worksheets) {
    const original = byId.get(entry.sheet.id);
    if (entry.signature === original?.signature) continue;
    const existing = original && bySignature.get(entry.signature);
    const id = existing?.sheet.id || (original ? crypto.randomUUID() : entry.sheet.id);
    if (!existing) {
      worksheets.push({ ...entry.sheet, id });
      for (const [cardId, value] of Object.entries(entry.fonts))
        server.fontSizes[cardFontKey(id, cardId)] = value;
      for (const [cardId, value] of Object.entries(entry.styles))
        server.cardStyles[cardFontKey(id, cardId)] = value;
    }
    if (activeWorksheetId === entry.sheet.id) activeWorksheetId = id;
  }
  return {
    added: worksheets.length - server.worksheets.length,
    snapshot: {
      ...online,
      worksheets,
      activeWorksheetId,
      cardPrint: savedCardPrint({
        ...server.print,
        fontSizes: server.fontSizes,
        cardStyles: server.cardStyles,
      }),
    },
  };
}
