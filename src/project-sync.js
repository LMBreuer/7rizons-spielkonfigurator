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
