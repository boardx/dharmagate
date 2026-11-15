/** Owned retrieval core. Data, current rights, identity and providers are explicit server adapters. */
const encoder = new TextEncoder();
export class EvidenceSearchError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new EvidenceSearchError(status, code); };
const idOK = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.test(x);
const shaOK = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const clean = (x, max = 160) => typeof x === 'string' && x.length > 0 && x.length <= max && !/[\u0000-\u001f\u007f]/u.test(x);
const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x) : Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' : '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
export async function sha256(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export const sourceFingerprint = r => sha256(canonical(Object.fromEntries(['editionId', 'segmentId', 'title', 'language', 'collection', 'version', 'sourceCommit', 'sourceSha256', 'segmentSha256'].map(k => [k, r[k]]))));
const norm = x => x.normalize('NFC').toLocaleLowerCase('und');
const key = x => x.editionId + '\u0000' + x.segmentId;
const exactKeys = (x, keys) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(k => keys.includes(k));
export function tokenize(text) {
  const terms = [];
  for (const part of norm(text).matchAll(/[\p{Script=Han}]+|[\p{L}\p{N}]+/gu)) {
    const chars = Array.from(part[0]);
    if (/^\p{Script=Han}/u.test(part[0])) {
      if (chars.length === 1) terms.push(chars[0]);
      else for (let i = 0; i < chars.length - 1; i++) terms.push(chars[i] + chars[i + 1]);
    } else terms.push(part[0]);
  }
  return terms;
}

/** A bounded BM25 index over explicitly supplied server-side records, never implicit corpus discovery.
 * readCurrent must reread the authoritative edition/segment and rights; index metadata is not authority.
 */
export function createLexicalRepository({ records, readCurrent, revision, maxCharacters = 4_000_000 } = {}) {
  if (!Array.isArray(records) || records.length > 20_000 || typeof readCurrent !== 'function' || !clean(revision, 120)) fail(400, 'INVALID_INDEX_CONFIGURATION');
  const seen = new Set(), documents = []; let characters = 0;
  for (const r of records) {
    if (!r || !idOK(r.editionId) || !idOK(r.segmentId) || !clean(r.title, 300) || typeof r.text !== 'string' || r.text.length > 16_000 || !clean(r.language, 40) || !clean(r.collection, 100) || !clean(r.version, 160) || !/^[a-f0-9]{40}$/.test(r.sourceCommit) || !shaOK(r.sourceSha256) || !shaOK(r.segmentSha256) || seen.has(key(r))) fail(400, 'INVALID_INDEX_RECORD');
    characters += r.text.length + r.title.length;
    if (characters > maxCharacters) fail(413, 'INDEX_CAPACITY_EXCEEDED');
    seen.add(key(r));
    const frequencies = new Map(), terms = tokenize(r.title + ' ' + r.text);
    for (const t of terms) frequencies.set(t, (frequencies.get(t) || 0) + 1);
    documents.push({ editionId: r.editionId, segmentId: r.segmentId, language: r.language, collection: r.collection, frequencies, length: Math.max(1, terms.length), normalized: norm(r.title + '\n' + r.text), fingerprint: sourceFingerprint(r), textHash: sha256(r.text), expectedTextHash: r.segmentSha256 });
  }
  return Object.freeze({
    revision, readCurrent, scopedRetrieval: true,
    async lexical({ query, filters, limit, isEligible, signal }) {
      if (typeof isEligible !== 'function') fail(503, 'SCOPE_FILTER_REQUIRED');
      const visible = [];
      for (const d of documents) {
        if (signal?.aborted) fail(504, 'PROVIDER_TIMEOUT');
        if (filters.editionId && d.editionId !== filters.editionId || filters.language && d.language !== filters.language || filters.collection && d.collection !== filters.collection) continue;
        const fingerprint = await d.fingerprint;
        if (await isEligible({ editionId: d.editionId, segmentId: d.segmentId, sourceFingerprint: fingerprint })) {
          if (await d.textHash !== d.expectedTextHash) fail(503, 'INDEX_INTEGRITY_FAILED');
          visible.push(d);
        }
      }
      const average = visible.reduce((n, d) => n + d.length, 0) / Math.max(1, visible.length), df = new Map();
      for (const d of visible) for (const t of d.frequencies.keys()) df.set(t, (df.get(t) || 0) + 1);
      const terms = [...new Set(tokenize(query))], q = norm(query), found = [];
      for (const d of visible) {
        let score = d.normalized.includes(q) ? 4 : 0;
        for (const t of terms) { const f = d.frequencies.get(t) || 0; if (!f) continue; const inverse = Math.log(1 + (visible.length - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5)); score += inverse * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * d.length / average)); }
        if (score > 0) found.push({ editionId: d.editionId, segmentId: d.segmentId, score, sourceFingerprint: await d.fingerprint });
      }
      return found.sort((a, b) => b.score - a.score || key(a).localeCompare(key(b))).slice(0, limit);
    }
  });
}

function safeURL(value, pathOnly = false) {
  if (typeof value !== 'string' || value.length > 1000 || /[\u0000-\u0020\u007f\\]/u.test(value)) return false;
  try {
    const u = new URL(value, 'https://dharmagate.us');
    if (u.protocol !== 'https:' || u.username || u.password) return false;
    if (pathOnly && (!value.startsWith('/') || value.startsWith('//') || u.origin !== 'https://dharmagate.us' || !/^\/(?:canon(?:\/|$)|read\/zh\/|explore\/research(?:\/|$))/.test(u.pathname))) return false;
    return true;
  } catch { return false; }
}
const citationFields = ['editionId', 'segmentId', 'version', 'sourceCommit', 'sourceSha256', 'segmentSha256', 'rightsRevision', 'locator', 'sourceURL', 'readURL'];
function validateCitationShape(c) {
  return exactKeys(c, citationFields) && Object.keys(c).length === citationFields.length && idOK(c.editionId) && idOK(c.segmentId) && clean(c.version) && /^[a-f0-9]{40}$/.test(c.sourceCommit) && shaOK(c.sourceSha256) && shaOK(c.segmentSha256) && clean(c.rightsRevision) && clean(c.locator, 300) && safeURL(c.sourceURL) && safeURL(c.readURL, true);
}
function options(input) {
  if (!exactKeys(input, ['query', 'filters', 'mode', 'limit']) || !clean(input.query) || input.query.trim().length < 2) fail(400, 'INVALID_QUERY');
  const filters = input.filters ?? {};
  if (!exactKeys(filters, ['editionId', 'language', 'collection']) || Object.entries(filters).some(([k, v]) => !clean(v, 100) || k === 'editionId' && !idOK(v))) fail(400, 'INVALID_FILTER');
  const mode = input.mode ?? 'keyword', limit = input.limit ?? 10;
  if (!['keyword', 'hybrid'].includes(mode) || !Number.isInteger(limit) || limit < 1 || limit > 20) fail(400, 'INVALID_SEARCH_OPTIONS');
  return { query: input.query.trim(), filters, mode, limit };
}
function handles(value) {
  if (!Array.isArray(value) || value.length > 100) fail(503, 'INDEX_RESPONSE_INVALID');
  const seen = new Set();
  return value.filter(x => {
    if (!exactKeys(x, ['editionId', 'segmentId', 'score', 'sourceFingerprint']) || !idOK(x.editionId) || !idOK(x.segmentId) || !Number.isFinite(x.score) || !shaOK(x.sourceFingerprint)) fail(503, 'INDEX_RESPONSE_INVALID');
    if (seen.has(key(x))) return false; seen.add(key(x)); return true;
  });
}
async function timed(work, milliseconds) {
  const controller = new AbortController(); let timer;
  try { return await Promise.race([work(controller.signal), new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new EvidenceSearchError(504, 'PROVIDER_TIMEOUT')); }, milliseconds); })]); }
  finally { clearTimeout(timer); }
}

/** Trust boundaries: request -> fresh authorizer -> handles -> current source/rights -> response.
 * A source resolver may never use client/index-supplied text, links or rights as authoritative.
 */
export function createEvidenceSearch({ repository, authorizeRequest, semanticProvider, modelProvider, answerPolicy, budget, enabled = false, providerTimeoutMs = 8_000, maxConcurrent = 4, answerCacheEntries = 32, answerCacheTTL = 30_000, now = Date.now } = {}) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 32 || !Number.isInteger(providerTimeoutMs) || providerTimeoutMs < 1 || providerTimeoutMs > 30_000 || !Number.isInteger(answerCacheEntries) || answerCacheEntries < 0 || answerCacheEntries > 128 || !Number.isInteger(answerCacheTTL) || answerCacheTTL < 0 || answerCacheTTL > 60_000) fail(400, 'INVALID_SERVICE_LIMITS');
  let inFlight = 0; const cache = new Map();
  async function auth(request, action, resource = null) {
    if (!enabled || !repository || typeof repository.lexical !== 'function' || typeof repository.readCurrent !== 'function' || !clean(repository.revision, 120) || typeof authorizeRequest !== 'function') fail(503, 'SEARCH_NOT_CONFIGURED');
    if (!(request instanceof Request) || new URL(request.url).origin !== 'https://dharmagate.us') fail(403, 'REQUEST_CONTEXT_DENIED');
    const a = await authorizeRequest(request, { action, ...(resource ? { editionId: resource.editionId, segmentId: resource.segmentId } : {}) });
    if (!a || a.allow !== true || !clean(a.principalId, 160) || !clean(a.revision, 160)) fail(403, 'ACCESS_DENIED');
    if (resource && a.resourceAuthorized !== true) fail(403, 'RESOURCE_ACCESS_DENIED');
    return { principalId: a.principalId, revision: a.revision };
  }
  const same = (a, b) => a.principalId === b.principalId && a.revision === b.revision;
  async function source(request, handle, action = 'search', expectedActor) {
    const access = await auth(request, 'source:' + action, handle);
    if (expectedActor && !same(access, expectedActor)) fail(403, 'ACCESS_CHANGED');
    const r = await repository.readCurrent({ request, editionId: handle.editionId, segmentId: handle.segmentId });
    if (!r || r.editionId !== handle.editionId || r.segmentId !== handle.segmentId || !r.rights || r.rights.status !== 'active' || r.rights.display !== true || r.rights.search !== true || action === 'rag' && r.rights.rag !== true || action === 'embedding' && r.rights.embedding !== true) fail(403, 'SOURCE_UNAVAILABLE');
    if (!clean(r.title, 300) || typeof r.text !== 'string' || !r.text.length || r.text.length > 16_000 || !clean(r.language, 40) || !clean(r.collection, 100)) fail(503, 'SOURCE_INTEGRITY_FAILED');
    const citation = Object.fromEntries(citationFields.map(k => [k, k === 'rightsRevision' ? r.rights.revision : r[k]]));
    if (!validateCitationShape(citation) || await sha256(r.text) !== r.segmentSha256) fail(503, 'SOURCE_INTEGRITY_FAILED');
    const after = await auth(request, 'source:' + action, handle);
    if (!same(access, after)) fail(403, 'ACCESS_CHANGED');
    return { ...r, citation };
  }
  async function recheck(request, records, action, actor) {
    for (const old of records) { const fresh = await source(request, old.citation, action, actor); if (canonical(fresh.citation) !== canonical(old.citation)) fail(409, 'EVIDENCE_CHANGED'); }
  }
  async function searchWork(request, input, purpose = 'search') {
    const config = options(input), before = await auth(request, purpose), candidates = new Map(), indexVersion = repository.revision, eligible = new Map();
    let semanticVersion = null; const semanticEligibleSources = new Map();
    if (repository.scopedRetrieval !== true) fail(503, 'SCOPED_INDEX_REQUIRED');
    const isEligible = async handle => {
      if (!idOK(handle?.editionId) || !idOK(handle?.segmentId)) fail(503, 'INDEX_RESPONSE_INVALID');
      try {
        const current = await source(request, handle, purpose === 'answer' ? 'rag' : 'search', before);
        if (!shaOK(handle.sourceFingerprint) || await sourceFingerprint(current) !== handle.sourceFingerprint) fail(409, 'INDEX_SOURCE_CHANGED');
        eligible.set(key(handle), current); return true;
      }
      catch (e) { if (e instanceof EvidenceSearchError && e.status === 403 && e.code !== 'ACCESS_CHANGED') return false; throw e; }
    };
    const lexical = handles(await timed(signal => repository.lexical({ ...config, limit: 100, isEligible, signal, principalId: before.principalId, authorizationRevision: before.revision }), providerTimeoutMs));
    if (lexical.some(h => !eligible.has(key(h)))) fail(503, 'INDEX_SCOPE_CONTRACT_VIOLATION');
    lexical.forEach((h, i) => candidates.set(key(h), { handle: h, lexicalRank: i + 1 }));
    if (config.mode === 'hybrid') {
      if (typeof semanticProvider?.search !== 'function' || !clean(semanticProvider.version, 120)) fail(503, 'SEMANTIC_PROVIDER_NOT_CONFIGURED');
      if (semanticProvider.scopedRetrieval !== true) fail(503, 'SCOPED_SEMANTIC_PROVIDER_REQUIRED');
      const semanticAuth = await auth(request, 'semantic-query'); if (!same(before, semanticAuth)) fail(403, 'ACCESS_CHANGED');
      semanticVersion = semanticProvider.version;
      const semanticEligible = async handle => {
        if (!(await isEligible(handle))) return false;
        try { const permitted = await source(request, handle, 'embedding', before); semanticEligibleSources.set(key(handle), permitted); return true; }
        catch (e) { if (e instanceof EvidenceSearchError && e.status === 403 && e.code !== 'ACCESS_CHANGED') return false; throw e; }
      };
      const semantic = handles(await timed(signal => semanticProvider.search({ query: config.query, filters: config.filters, limit: 100, signal, principalId: before.principalId, authorizationRevision: before.revision, isEligible: semanticEligible }), providerTimeoutMs));
      if (semanticProvider.version !== semanticVersion) fail(409, 'SEMANTIC_PROVIDER_CHANGED');
      if (semantic.some(h => !eligible.has(key(h)))) fail(503, 'SEMANTIC_SCOPE_CONTRACT_VIOLATION');
      semantic.forEach((h, i) => { const k = key(h), x = candidates.get(k) || { handle: h }; x.semanticRank = i + 1; candidates.set(k, x); });
    }
    const authorized = [];
    for (const x of candidates.values()) {
      let r;
      try { r = await source(request, x.handle, purpose === 'answer' ? 'rag' : 'search', before); }
      catch (e) { if (e instanceof EvidenceSearchError && e.status === 403 && !eligible.has(key(x.handle))) continue; throw e; }
      if (await sourceFingerprint(r) !== x.handle.sourceFingerprint) fail(409, 'INDEX_SOURCE_CHANGED');
      if (Object.entries(config.filters).some(([k, v]) => r[k] !== v)) continue;
      let semanticRank = null;
      if (r.rights.embedding === true && x.semanticRank) {
        try { const semanticSource = await source(request, x.handle, 'embedding', before); if (canonical(semanticSource.citation) !== canonical(r.citation)) fail(409, 'EVIDENCE_CHANGED'); semanticRank = x.semanticRank; }
        catch (e) { if (!(e instanceof EvidenceSearchError) || e.status !== 403) throw e; }
      }
      if (!x.lexicalRank && !semanticRank) continue;
      const score = (x.lexicalRank ? 1 / (60 + x.lexicalRank) : 0) + (semanticRank ? 1 / (60 + semanticRank) : 0);
      authorized.push({ source: r, score, usedSemantic: !!semanticRank });
    }
    authorized.sort((a, b) => b.score - a.score || key(a.source).localeCompare(key(b.source)));
    const selected = authorized.slice(0, config.limit), after = await auth(request, purpose);
    if (!same(before, after)) fail(403, 'ACCESS_CHANGED');
    await recheck(request, [...eligible.values()], purpose === 'answer' ? 'rag' : 'search', before);
    await recheck(request, [...semanticEligibleSources.values()], 'embedding', before);
    if (repository.revision !== indexVersion) fail(409, 'INDEX_CHANGED');
    return { actor: before, records: selected.map(x => x.source), payload: {
      query: config.query, mode: selected.some(x => x.usedSemantic) ? 'hybrid-rrf' : 'keyword',
      semanticProviderVersion: semanticVersion, indexVersion,
      totalWithinCandidateWindow: authorized.length, candidateWindowLimit: config.mode === 'hybrid' ? 200 : 100,
      items: selected.map((x, i) => ({ title: x.source.title, language: x.source.language, collection: x.source.collection, snippet: x.source.text.slice(0, 360), citation: x.source.citation, rank: i + 1, matchMode: x.usedSemantic ? 'hybrid-rrf' : 'keyword' })),
      emptyReason: selected.length ? null : 'NO_AUTHORIZED_MATCH', semanticQualityAccepted: false
    } };
  }
  async function boundary(work) {
    if (inFlight >= maxConcurrent) return { ok: false, status: 429, error: 'CONCURRENT_LIMIT', retryAfter: 1 };
    inFlight++;
    try { return { ok: true, status: 200, ...(await work()) }; }
    catch (e) { return { ok: false, status: e instanceof EvidenceSearchError ? e.status : 503, error: e instanceof EvidenceSearchError ? e.code : 'SEARCH_UNAVAILABLE' }; }
    finally { inFlight--; }
  }
  async function validateWork(request, input, expectedActor) {
    if (!exactKeys(input, ['citation', 'quote']) || !validateCitationShape(input.citation) || input.quote !== undefined && !clean(input.quote, 512)) fail(400, 'INVALID_CITATION');
    const before = await auth(request, 'citation'); if (expectedActor && !same(before, expectedActor)) fail(403, 'ACCESS_CHANGED');
    const r = await source(request, input.citation, 'search', before);
    if (canonical(r.citation) !== canonical(input.citation)) fail(409, 'CITATION_CHANGED');
    if (input.quote !== undefined && !r.text.includes(input.quote)) fail(422, 'QUOTE_NOT_IN_SOURCE');
    const start = input.quote === undefined ? null : r.text.indexOf(input.quote), after = await auth(request, 'citation');
    if (!same(before, after)) fail(403, 'ACCESS_CHANGED'); await recheck(request, [r], 'search', before);
    return { citation: r.citation, quote: input.quote ?? null, quoteRange: start === null ? null : { start, end: start + input.quote.length, unit: 'utf-16-code-units' }, verification: 'current-source-location-and-exact-quote', semanticSupportAssessed: false };
  }
  async function answerWork(request, input) {
    if (!exactKeys(input, ['question', 'filters', 'mode']) || !clean(input.question, 160) || input.question.trim().length < 2) fail(400, 'INVALID_QUESTION');
    if (typeof answerPolicy !== 'function') fail(503, 'ANSWER_POLICY_NOT_CONFIGURED');
    const actor = await auth(request, 'answer'), policy = await answerPolicy({ request, question: input.question });
    if (!policy?.allow || !clean(policy.version, 100)) fail(403, 'QUESTION_POLICY_DENIED');
    const version = modelProvider?.version, indexVersion = repository.revision;
    const cacheKey = await sha256(canonical({ actor, question: input.question, filters: input.filters ?? {}, mode: input.mode ?? 'keyword', policy: policy.version, model: version ?? null, index: indexVersion }));
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now()) {
      try { await recheck(request, cached.records, 'rag', actor); const after = await auth(request, 'answer'); if (!same(actor, after)) fail(403, 'ACCESS_CHANGED'); if (repository.revision !== indexVersion || modelProvider?.version !== version) fail(409, 'PROVIDER_OR_INDEX_CHANGED'); }
      catch (e) { cache.delete(cacheKey); throw e; }
      return { ...structuredClone(cached.payload), cacheHit: true };
    }
    cache.delete(cacheKey);
    const result = await searchWork(request, { query: input.question, filters: input.filters, mode: input.mode, limit: 5 }, 'answer');
    if (!same(actor, result.actor)) fail(403, 'ACCESS_CHANGED');
    if (result.payload.indexVersion !== indexVersion) fail(409, 'INDEX_CHANGED');
    if (!result.records.length) return { kind: 'no-evidence', message: '没有足够且获准用于回答的资料，请缩小问题或直接阅读原文。', claims: [], citations: [], modelVersion: null, indexVersion: repository.revision, cacheHit: false };
    if (typeof modelProvider?.generate !== 'function' || !clean(version, 120)) fail(503, 'MODEL_NOT_CONFIGURED');
    if (typeof budget?.reserve !== 'function') fail(503, 'BUDGET_NOT_CONFIGURED');
    const reservation = await budget.reserve({ principalId: actor.principalId, operation: 'evidence-answer', maxOutputCharacters: 4000 });
    if (!reservation?.allowed || typeof reservation.commit !== 'function' || typeof reservation.release !== 'function') fail(429, 'BUDGET_DENIED');
    let settled = false, attempted = false;
    try {
      let remaining = 6000;
      const evidence = result.records.map((r, i) => { const text = r.text.slice(0, Math.min(1600, remaining)); remaining -= text.length; return { id: 'E' + (i + 1), text, citation: r.citation }; }).filter(x => x.text);
      attempted = true;
      const draft = await timed(signal => modelProvider.generate({ question: input.question, evidence, signal, maxOutputCharacters: 4000 }), providerTimeoutMs);
      if (!exactKeys(draft, ['claims']) || !Array.isArray(draft.claims) || !draft.claims.length || draft.claims.length > 8 || encoder.encode(JSON.stringify(draft)).length > 12_000) fail(502, 'MODEL_RESPONSE_INVALID');
      const claims = [];
      for (const claim of draft.claims) {
        if (!exactKeys(claim, ['text', 'evidence']) || !clean(claim.text, 500) || !Array.isArray(claim.evidence) || !claim.evidence.length || claim.evidence.length > 5) fail(502, 'MODEL_RESPONSE_INVALID');
        const cites = [];
        for (const reference of claim.evidence) {
          if (!exactKeys(reference, ['id', 'quote']) || !clean(reference.quote, 512)) fail(502, 'MODEL_CITATION_INVALID');
          const selected = evidence.find(e => e.id === reference.id);
          if (!selected || !selected.text.includes(reference.quote)) fail(502, 'MODEL_CITATION_INVALID');
          cites.push({ id: selected.id, quote: reference.quote, citation: selected.citation });
        }
        claims.push({ text: claim.text, evidence: cites });
      }
      await recheck(request, result.records, 'rag', actor); const after = await auth(request, 'answer'); if (!same(actor, after)) fail(403, 'ACCESS_CHANGED');
      if (repository.revision !== indexVersion || modelProvider.version !== version) fail(409, 'PROVIDER_OR_INDEX_CHANGED');
      settled = true; await reservation.commit({ outcome: 'provider-attempt-succeeded', modelVersion: version });
      await recheck(request, result.records, 'rag', actor); const finalActor = await auth(request, 'answer'); if (!same(actor, finalActor)) fail(403, 'ACCESS_CHANGED');
      if (repository.revision !== indexVersion || modelProvider.version !== version) fail(409, 'PROVIDER_OR_INDEX_CHANGED');
      const payload = { kind: 'evidence-draft', claims, citations: evidence.map(e => e.citation), modelVersion: version, indexVersion, policyVersion: policy.version, semanticSupportAssessed: false, notice: 'AI草稿；引文已核对位置与字句，不代表解释已获人工或语义支持性审核。', cacheHit: false };
      if (answerCacheEntries && answerCacheTTL) { if (cache.size >= answerCacheEntries) cache.delete(cache.keys().next().value); cache.set(cacheKey, { expires: now() + answerCacheTTL, records: result.records.map(r => ({ citation: r.citation })), payload: structuredClone(payload) }); }
      return payload;
    } finally {
      if (!settled) {
        settled = true;
        if (attempted) await reservation.commit({ outcome: 'provider-attempt-failed', modelVersion: version });
        else await reservation.release();
      }
    }
  }
  return Object.freeze({
    capabilities: Object.freeze({ keyword: enabled && typeof repository?.lexical === 'function' && typeof repository?.readCurrent === 'function' && repository?.scopedRetrieval === true && typeof authorizeRequest === 'function', hybrid: enabled && semanticProvider?.scopedRetrieval === true && typeof semanticProvider?.search === 'function', answer: enabled && typeof modelProvider?.generate === 'function' && typeof answerPolicy === 'function' && typeof budget?.reserve === 'function' }),
    search: ({ request, ...input } = {}) => boundary(async () => (await searchWork(request, input)).payload),
    validateCitation: ({ request, ...input } = {}) => boundary(() => validateWork(request, input)),
    answer: ({ request, ...input } = {}) => boundary(() => answerWork(request, input)),
    async relations({ request, citations } = {}) { return boundary(async () => {
      if (!Array.isArray(citations) || !citations.length || citations.length > 20) fail(400, 'INVALID_SELECTIONS');
      const actor = await auth(request, 'relations');
      const checked = []; for (const citation of citations) checked.push((await validateWork(request, { citation }, actor)).citation);
      await recheck(request, checked.map(citation => ({ citation })), 'search', actor);
      const after = await auth(request, 'relations'); if (!same(actor, after)) fail(403, 'ACCESS_CHANGED');
      return { kind: 'recorded-source-relations', nodes: checked.map(c => ({ editionId: c.editionId, version: c.version, segmentId: c.segmentId, sourceSha256: c.sourceSha256, segmentSha256: c.segmentSha256 })), edges: checked.map(c => ({ from: c.editionId + '@' + c.version, relation: 'contains-recorded-segment', to: c.segmentId, citation: c })), historicalRelationsInferred: false };
    }); },
  });
}
