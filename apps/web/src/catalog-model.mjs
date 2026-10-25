/** Transport-independent model validation. No database connection or migration. */
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function requireValue(ok, message) { if (!ok) throw new TypeError(message); }
export function validateCatalog(catalog) {
  const tables = {};
  for (const kind of ['sources', 'works', 'editions', 'assets', 'fragments']) {
    requireValue(Array.isArray(catalog?.[kind]), `Missing ${kind}`);
    tables[kind] = new Map();
    for (const row of catalog[kind]) {
      requireValue(id(row.id) && !tables[kind].has(row.id), `Invalid/duplicate ${kind} id`);
      tables[kind].set(row.id, row);
    }
  }
  for (const row of tables.sources.values()) {
    const url = new URL(row.sourceUrl);
    requireValue(url.protocol === 'https:' && !url.username && !url.password, 'Source must be credential-free HTTPS');
  }
  for (const row of tables.works.values()) {
    requireValue(typeof row.title === 'string' && row.title.length > 0, 'Work title required');
    requireValue(row.author === null || typeof row.author === 'string', 'Unknown author must remain null');
    requireValue(row.date === null || typeof row.date === 'string', 'Unknown date must remain null');
  }
  for (const row of tables.editions.values()) {
    requireValue(tables.works.has(row.workId) && tables.sources.has(row.sourceId), 'Edition relationship missing');
    requireValue(id(row.contentVersion) && typeof row.language === 'string' && row.language.length > 0, 'Edition version/language required');
    requireValue(row.translator === null || typeof row.translator === 'string', 'Unknown translator must remain null');
  }
  for (const row of tables.assets.values()) {
    const edition = tables.editions.get(row.editionId);
    requireValue(edition && edition.sourceId === row.sourceId, 'Asset edition/source mismatch');
    requireValue(hash(row.sha256) && id(row.contentVersion) && row.contentVersion === edition.contentVersion, 'Asset integrity/version required');
  }
  for (const row of tables.fragments.values()) {
    const asset = tables.assets.get(row.assetId);
    requireValue(asset && asset.editionId === row.editionId && asset.contentVersion === row.contentVersion, 'Fragment lineage mismatch');
    requireValue(row.assetSha256 === asset.sha256, 'Fragment hash mismatch');
    const loc = row.locator;
    const valid = loc?.kind === 'paragraph' ? id(loc.value)
      : loc?.kind === 'page' ? Number.isSafeInteger(loc.value) && loc.value > 0
      : loc?.kind === 'timecode' && Number.isFinite(loc.start) && Number.isFinite(loc.end) && loc.start >= 0 && loc.end > loc.start;
    requireValue(valid, 'Stable locator required');
  }
  return true;
}

export function storageKey({ tenantId, sourceId, assetId, contentVersion, kind, sha256 }) {
  requireValue([tenantId, sourceId, assetId, contentVersion].every(id), 'Unsafe storage path component');
  requireValue(['original', 'normalized', 'ocr', 'transcript', 'thumbnail'].includes(kind) && hash(sha256), 'Invalid derivative or hash');
  // Private by default; no bucket creation, upload, public URL or ACL change.
  return `private/${tenantId}/${sourceId}/${assetId}/${contentVersion}/${kind}/${sha256}`;
}
