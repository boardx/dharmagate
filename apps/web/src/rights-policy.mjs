/** Deny-by-default use-purpose rules. Real grants require independent human evidence. */
export const purposes = Object.freeze(['metadata_index', 'preserve_original', 'public_display', 'download', 'derive', 'rag_quote', 'model_training', 'redistribution']);
export function evaluateRights(record, purpose, now = Date.now()) {
  if (!purposes.includes(purpose)) return { allowed: false, reason: 'unknown_purpose' };
  if (!record || record.status !== 'approved') return { allowed: false, reason: 'not_approved' };
  if (!Number.isSafeInteger(record.rightsVersion) || record.rightsVersion < 1 || !record.evidence?.snapshotSha256?.match(/^[a-f0-9]{64}$/) || !record.evidence?.reviewedBy)
    return { allowed: false, reason: 'missing_evidence' };
  const expires = record.expiresAt === null ? Infinity : Date.parse(record.expiresAt);
  if (!Number.isFinite(now) || !(expires > now)) return { allowed: false, reason: 'expired_or_invalid' };
  // Conditional and unknown require resolution by the authoritative rights process, not inference here.
  return record.permissions?.[purpose] === 'allowed'
    ? { allowed: true, rightsVersion: record.rightsVersion }
    : { allowed: false, reason: 'purpose_not_allowed' };
}

export function createRightsGuard({ ledger, clock = () => Date.now() }) {
  if (typeof ledger?.getCurrent !== 'function') throw new TypeError('Authoritative current-rights reader required');
  async function snapshot(assetIds, purpose) {
    const rows = await Promise.all(assetIds.map(assetId => ledger.getCurrent(assetId)));
    if (rows.some((row, i) => row?.assetId !== assetIds[i] || !evaluateRights(row, purpose, clock()).allowed))
      throw new Error('CONTENT_NOT_AVAILABLE');
    return rows.map(row => row.rightsVersion);
  }
  return {
    async read({ assetIds, purpose }, load) {
      // Dependencies must come from trusted server-side provenance, never client-supplied/cache-only labels.
      if (!Array.isArray(assetIds) || !assetIds.length || assetIds.some(x => typeof x !== 'string' || !x) || typeof load !== 'function')
        throw new Error('CONTENT_NOT_AVAILABLE');
      const before = await snapshot(assetIds, purpose);
      const content = await load(); // Includes old-link, search-index and answer-cache read paths.
      const after = await snapshot(assetIds, purpose);
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('CONTENT_NOT_AVAILABLE');
      return content;
    },
  };
}

export function validatePilotManifest(records) {
  if (!Array.isArray(records) || records.length < 10 || records.length > 30) return false;
  if (new Set(records.map(x => x.sourceId)).size !== 1 || !records[0].sourceId) return false;
  if (new Set(records.map(x => x.assetId)).size !== records.length) return false;
  return records.every(row => typeof row.editionId === 'string' && row.editionId &&
    evaluateRights(row, 'preserve_original').allowed && evaluateRights(row, 'public_display').allowed);
}
