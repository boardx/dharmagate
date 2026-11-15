import { createEvidenceSearch, createLexicalRepository, EvidenceSearchError, sha256 } from './index.mjs';
import { readingModel } from '../tei-browser-reader.mjs';

const deny = (status, code) => { throw new EvidenceSearchError(status, code); };
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
const unitPattern = /^[A-Z]{1,2}\d{2,3}n[0-9A-Za-z_-]{1,24}$/;
const shaPattern = /^[a-f0-9]{64}$/;
const origin = 'https://dharmagate.us';

/** Opt-in adapter for a bounded, explicitly admitted existing canonical reading layer.
 * It performs no filesystem discovery, upstream fetch, bucket listing/write or model use.
 * readVerifiedUnit is the caller's existing source service and returns {rawBytes, document}.
 * document must be the existing TEI reader output, not a newly flattened structured preview.
 * readRights independently rereads authoritative public/display/search permission for those exact pins.
 */
export async function createPublicCanonSearch({ admissions, readVerifiedUnit, readRights, indexRevision, maxCharacters = 1_000_000 } = {}) {
  if (!Array.isArray(admissions) || !admissions.length || admissions.length > 32 || typeof readVerifiedUnit !== 'function' || typeof readRights !== 'function' || typeof indexRevision !== 'string' || !indexRevision.length) deny(400, 'CANON_SEARCH_CONFIGURATION_REQUIRED');
  const pins = new Map(), units = new Map(), records = [];
  for (const admission of admissions) {
    if (!admission || !unitPattern.test(admission.id) || pins.has(admission.id) || !/^[a-f0-9]{40}$/.test(admission.sourceCommit) || !shaPattern.test(admission.sourceSha256) || !shaPattern.test(admission.readingSha256) || admission.publicationEligible !== true) deny(400, 'CANON_ADMISSION_INVALID');
    pins.set(admission.id, Object.freeze({ ...admission }));
  }
  async function currentRights(editionId) {
    const pin = pins.get(editionId); if (!pin) deny(403, 'CANON_UNIT_NOT_ADMITTED');
    const r = await readRights({ editionId, sourceCommit: pin.sourceCommit, sourceSha256: pin.sourceSha256, readingSha256: pin.readingSha256 });
    if (!r || r.status !== 'active' || r.public !== true || r.display !== true || r.search !== true || r.publicationEligible !== true || r.sourceCommit !== pin.sourceCommit || r.sourceSha256 !== pin.sourceSha256 || r.readingSha256 !== pin.readingSha256 || typeof r.revision !== 'string' || !r.revision.length) deny(403, 'CANON_SEARCH_RIGHTS_DENIED');
    // This adapter is display/search only. General content display is never a model-use grant.
    return { status: 'active', revision: r.revision, display: true, search: true, embedding: false, rag: false };
  }
  for (const [id, pin] of pins) {
    await currentRights(id);
    const loaded = await readVerifiedUnit({ id, sourceCommit: pin.sourceCommit, sourceSha256: pin.sourceSha256, readingSha256: pin.readingSha256 });
    if (!(loaded?.rawBytes instanceof Uint8Array) || loaded.rawBytes.byteLength > 32_000_000) deny(503, 'CANON_ORIGINAL_HASH_MISMATCH');
    // The source adapter retains its references. Snapshot both synchronously before
    // the first digest await, so an in-flight mutation cannot escape the pins.
    const rawBytes = loaded.rawBytes.slice(), doc = structuredClone(loaded.document);
    const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
    freeze(doc);
    if (hex(await crypto.subtle.digest('SHA-256', rawBytes)) !== pin.sourceSha256) deny(503, 'CANON_ORIGINAL_HASH_MISMATCH');
    if (!doc || doc.id !== id || typeof doc.title !== 'string' || !doc.title.length || !Array.isArray(doc.lines) || !doc.lines.length || doc.aiTranslated !== false || doc.publicationEligible === false || doc.commit !== pin.sourceCommit || doc.rawSha256 !== pin.sourceSha256 || await sha256(JSON.stringify(readingModel(doc))) !== pin.readingSha256) deny(503, 'CANON_READING_HASH_MISMATCH');
    // Rebuild the existing reader's juan-local pagination, never flat n/120.
    const volumes = new Map(), pages = new Map();
    for (const line of doc.lines) { const key = line?.juan; if (!volumes.has(key)) volumes.set(key, []); volumes.get(key).push(line); }
    let pageNumber = 0;
    for (const group of volumes.values()) for (let offset = 0; offset < group.length; offset += 120) { pageNumber++; for (const line of group.slice(offset, offset + 120)) pages.set(line?.id, pageNumber); }
    const lines = new Map();
    for (let n = 0; n < doc.lines.length; n++) {
      const line = doc.lines[n];
      if (!line || typeof line.id !== 'string' || !line.id.startsWith(id + ':') || lines.has(line.id) || typeof line.locator !== 'string' || typeof line.text !== 'string') deny(503, 'CANON_LINE_IDENTITY_MISMATCH');
      const page = pages.get(line.id);
      const segment = Object.freeze({ editionId: id, segmentId: line.id, title: doc.title, text: line.text, language: 'zh', collection: id.match(/^[A-Z]+/)[0], version: pin.sourceCommit + ':' + pin.sourceSha256, sourceCommit: pin.sourceCommit, sourceSha256: pin.sourceSha256, segmentSha256: await sha256(line.text), locator: line.locator, sourceURL: origin + '/canon/zh/api/source/' + encodeURIComponent(id), readURL: '/canon/zh?unit=' + encodeURIComponent(id) + '&page=' + page + '#' + encodeURIComponent(line.id) });
      lines.set(line.id, segment); records.push(segment);
    }
    units.set(id, lines);
    await currentRights(id);
  }
  const repository = createLexicalRepository({ records, revision: indexRevision, maxCharacters, async readCurrent({ editionId, segmentId }) {
    const rights = await currentRights(editionId), segment = units.get(editionId)?.get(segmentId);
    return segment ? { ...segment, rights } : null;
  } });
  const authorizeRequest = async (request, context) => {
    const actor = { allow: false, principalId: 'public-canon-reader', revision: 'public-canon:' + indexRevision };
    if (!(request instanceof Request) || new URL(request.url).origin !== origin || !['search', 'citation', 'relations', 'source:search'].includes(context.action)) return actor;
    if (context.editionId) {
      try { await currentRights(context.editionId); if (!units.get(context.editionId)?.has(context.segmentId)) return actor; }
      catch { return actor; }
      return { ...actor, allow: true, resourceAuthorized: true };
    }
    return { ...actor, allow: true };
  };
  const service = createEvidenceSearch({ repository, authorizeRequest, enabled: true });
  return Object.freeze({ service, repository, authorizeRequest, scope: Object.freeze({ kind: 'explicit-public-canon-subset', sourceUnitCount: units.size, sourceSegmentCount: records.length, indexVersion: indexRevision, semanticSearch: false, rag: false, embedding: false, wholeCanonSearch: false }) });
}
