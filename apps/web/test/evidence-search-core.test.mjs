import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceSearch, createLexicalRepository, sha256, tokenize } from '../src/evidence-search/index.mjs';

import { fixture } from './evidence-search-synthetic-fixture.mjs';

test('Unicode keyword index uses Han bigrams and preserves diacritics', () => {
  assert.deepEqual(tokenize('原文阅读 ānanda'), ['原文', '文阅', '阅读', 'ānanda']);
  assert.deepEqual(tokenize('a\u0304nanda'), ['ānanda']);
});
test('keyword search ranks exact text, returns only freshly authorized active sources and stable source hashes', async () => {
  const f = await fixture(), r = await f.service.search({ request: f.request, query: '每天阅读' });
  assert.equal(r.ok, true); assert.equal(r.items.length, 1); assert.equal(r.items[0].citation.editionId, 'fixture-a');
  assert.equal(r.items[0].citation.segmentSha256, await sha256(f.sources.get('fixture-a').text));
  assert.equal(r.mode, 'keyword'); assert.equal(r.semanticProviderVersion, null); assert.ok(f.state.sourceAuth > 0);
  assert.equal(r.semanticQualityAccepted, false); assert.equal(r.candidateWindowLimit, 100);
});
test('resource authorization is mandatory even with global search permission', async () => {
  const f = await fixture({ authorizeRequest: async () => ({ allow: true, principalId: 'global-reader', revision: 'v1' }) });
  const r = await f.service.search({ request: f.request, query: '每天阅读' });
  assert.equal(r.ok, true); assert.deepEqual(r.items, []); assert.equal(f.state.reads, 0);
});
test('two actors cannot read each other private indexed text or citation', async () => {
  const f = await fixture(), a = await f.service.search({ request: f.request, query: '每天阅读' });
  f.state.actor = 'synthetic-reader-b';
  const b = await f.service.search({ request: f.request, query: '每天阅读' });
  assert.deepEqual(b.items.map(x => x.citation.editionId), ['fixture-private']);
  const forged = await f.service.validateCitation({ request: f.request, citation: a.items[0].citation });
  assert.equal(forged.status, 403); assert.equal(forged.citation, undefined);
});
test('input identity, empty filters, controls and excessive limits cannot be smuggled into the service', async () => {
  const f = await fixture();
  for (const input of [{ query: '每天阅读', principalId: 'admin' }, { query: 'a' }, { query: 'a\nwrong' }, { query: '每天阅读', limit: 21 }, { query: '每天阅读', filters: { role: 'admin' } }, { query: '每天阅读', filters: { language: '' } }]) assert.equal((await f.service.search({ request: f.request, ...input })).status, 400);
});
test('services are disabled by default and origin/context failures cannot reach the index', async () => {
  const f = await fixture({ enabled: false }); assert.equal((await f.service.search({ request: f.request, query: '每天阅读' })).status, 503); assert.equal(f.state.lexicalCalls, 0);
  const g = await fixture(); assert.equal((await g.service.search({ request: new Request('https://other.example/'), query: '每天阅读' })).status, 403);
});
test('hybrid mode performs RRF fusion with explicit provider version and does not call a missing provider', async () => {
  const f = await fixture(), r = await f.service.search({ request: f.request, query: '每天阅读', mode: 'hybrid' });
  assert.equal(r.ok, true); assert.equal(r.mode, 'hybrid-rrf'); assert.equal(r.semanticProviderVersion, 'synthetic-vector-v1'); assert.equal(r.items[0].citation.editionId, 'fixture-a');
  assert.ok(r.items.some(x => x.citation.editionId === 'fixture-b')); assert.equal(f.state.semanticCalls, 1);
  const g = await fixture({ semanticProvider: undefined }); assert.equal((await g.service.search({ request: g.request, query: '每天阅读', mode: 'hybrid' })).error, 'SEMANTIC_PROVIDER_NOT_CONFIGURED');
});
test('display/search permission never implies embedding permission or semantic-query authorization', async () => {
  const f = await fixture(); f.sources.get('fixture-b').rights.embedding = false;
  let r = await f.service.search({ request: f.request, query: '每天阅读', mode: 'hybrid' }); assert.deepEqual(r.items.map(x => x.citation.editionId), ['fixture-a']);
  const before = f.state.semanticCalls; f.state.onAuth = ctx => { if (ctx.action === 'semantic-query') f.state.allowed = false; };
  r = await f.service.search({ request: f.request, query: '每天阅读', mode: 'hybrid' }); assert.equal(r.status, 403); assert.equal(f.state.semanticCalls, before);
});
test('filters are applied again to authoritative source metadata rather than trusting a vector handle', async () => {
  const f = await fixture();
  const r = await f.service.search({ request: f.request, query: '每天阅读', mode: 'hybrid', filters: { collection: 'OTHER' } });
  assert.equal(f.state.semanticCalls, 1); assert.deepEqual(r.items, []);
});
test('invalid vector/index records and changed provider/index versions fail closed', async () => {
  const f = await fixture(); f.state.semanticResults = [{ editionId: 'fixture-b', segmentId: 'p1', score: 1, text: 'untrusted copied body' }];
  assert.equal((await f.service.search({ request: f.request, query: '每天阅读', mode: 'hybrid' })).error, 'INDEX_RESPONSE_INVALID');
  const g = await fixture(); g.state.onLexical = () => { g.repository.revision = 'changed-index'; };
  assert.equal((await g.service.search({ request: g.request, query: '每天阅读' })).error, 'INDEX_CHANGED');
});
test('mid-request principal/revision switch returns no results', async () => {
  const f = await fixture(); f.state.onRead = () => { f.state.actor = 'synthetic-reader-b'; };
  const r = await f.service.search({ request: f.request, query: '每天阅读' }); assert.equal(r.status, 403); assert.equal(r.items, undefined);
});
test('rights withdrawn during source read prevent old snippets from returning', async () => {
  const f = await fixture(); f.state.onRead = id => { if (id === 'fixture-a') f.sources.get(id).rights.status = 'withdrawn'; };
  const r = await f.service.search({ request: f.request, query: '每天阅读' }); assert.equal(r.status, 403); assert.equal(r.items, undefined);
});
test('source bytes, safe links and immutable provenance are validated independently of the index', async () => {
  const f = await fixture(); f.sources.get('fixture-a').text += 'tampered';
  assert.equal((await f.service.search({ request: f.request, query: '每天阅读' })).error, 'SOURCE_INTEGRITY_FAILED');
  const g = await fixture(); g.sources.get('fixture-a').readURL = '/admin';
  assert.equal((await g.service.search({ request: g.request, query: '每天阅读' })).error, 'SOURCE_INTEGRITY_FAILED');
  const h = await fixture(); h.sources.get('fixture-a').sourceURL = 'javascript:alert(1)';
  assert.equal((await h.service.search({ request: h.request, query: '每天阅读' })).error, 'SOURCE_INTEGRITY_FAILED');
});
test('citations reread exact current source; invented quote/version/page/hash cannot pass', async () => {
  const f = await fixture(), r = await f.service.search({ request: f.request, query: '每天阅读' }), citation = r.items[0].citation;
  const ok = await f.service.validateCitation({ request: f.request, citation, quote: '合成测试' }); assert.equal(ok.ok, true); assert.equal(ok.quoteRange.unit, 'utf-16-code-units'); assert.equal(ok.semanticSupportAssessed, false);
  for (const changed of [{ ...citation, version: 'forged' }, { ...citation, page: 33 }, { ...citation, segmentSha256: '0'.repeat(64) }]) assert.equal((await f.service.validateCitation({ request: f.request, citation: changed })).ok, false);
  assert.equal((await f.service.validateCitation({ request: f.request, citation, quote: '从未存在的句子' })).status, 422);
  f.sources.get('fixture-a').rights.revision = 'rights-v2'; assert.equal((await f.service.validateCitation({ request: f.request, citation })).status, 409);
});
test('no licensed RAG evidence refuses without invoking model or reserving budget', async () => {
  const f = await fixture(); for (const s of f.sources.values()) s.rights.rag = false;
  const r = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(r.ok, true); assert.equal(r.kind, 'no-evidence'); assert.equal(f.state.modelCalls, 0); assert.equal(f.state.reservations, 0);
});
test('model and policy defaults do not fake a working production answer', async () => {
  const f = await fixture({ modelProvider: undefined }); assert.equal((await f.service.answer({ request: f.request, question: '每天阅读' })).error, 'MODEL_NOT_CONFIGURED');
  const g = await fixture({ answerPolicy: undefined }); assert.equal((await g.service.answer({ request: g.request, question: '每天阅读' })).error, 'ANSWER_POLICY_NOT_CONFIGURED');
  const h = await fixture({ budget: undefined }); assert.equal((await h.service.answer({ request: h.request, question: '每天阅读' })).error, 'BUDGET_NOT_CONFIGURED');
});
test('evidence answer is bounded, labelled unreviewed and caches only with current source revalidation', async () => {
  const f = await fixture(), r = await f.service.answer({ request: f.request, question: '每天阅读' });
  assert.equal(r.ok, true); assert.equal(r.kind, 'evidence-draft'); assert.equal(r.semanticSupportAssessed, false); assert.equal(r.modelVersion, 'synthetic-model-v1'); assert.equal(r.claims.length, 1);
  assert.ok(f.state.lastModelEvidence.reduce((n, x) => n + x.text.length, 0) <= 6000); assert.deepEqual(f.state.charged, ['provider-attempt-succeeded']);
  const before = f.state.reads, hit = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(hit.cacheHit, true); assert.ok(f.state.reads > before); assert.equal(f.state.modelCalls, 1);
  f.sources.get('fixture-a').rights.status = 'withdrawn'; const denied = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(denied.status, 403); assert.equal(denied.claims, undefined); assert.equal(f.state.modelCalls, 1);
});
test('changed bytes or rights revision invalidate warm answer cache instead of returning old draft', async () => {
  const f = await fixture(); await f.service.answer({ request: f.request, question: '每天阅读' }); f.sources.get('fixture-a').rights.revision = 'changed';
  const r = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(r.status, 409); assert.equal(r.claims, undefined);
});
test('cached drafts are cloned and actor-scoped; client mutation cannot poison later answer', async () => {
  const f = await fixture(), a = await f.service.answer({ request: f.request, question: '每天阅读' }); a.claims[0].text = 'poison';
  const b = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.notEqual(b.claims[0].text, 'poison');
  f.state.actor = 'synthetic-reader-b'; const c = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(c.cacheHit, false); assert.equal(c.citations[0].editionId, 'fixture-private');
});
test('fabricated model evidence IDs/quotes are rejected and attempted compute still consumes reservation', async () => {
  for (const reference of [{ id: 'E999', quote: '合成' }, { id: 'E1', quote: '伪造不存在的句子' }]) {
    const f = await fixture(); f.state.draft = { claims: [{ text: 'unsupported', evidence: [reference] }] };
    const r = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(r.error, 'MODEL_CITATION_INVALID'); assert.deepEqual(f.state.charged, ['provider-attempt-failed']); assert.equal(f.state.released, 0);
  }
});
test('withdrawal during model generation or budget commit returns no stale answer', async () => {
  for (const hook of ['onGenerate', 'onCommit']) { const f = await fixture(); f.state[hook] = () => { f.sources.get('fixture-a').rights.status = 'withdrawn'; }; const r = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(r.status, 403); assert.equal(r.claims, undefined); assert.equal(f.state.charged.length, 1); }
});
test('model timeout is recoverable and settles budget without pretending the provider was cancelled physically', async () => {
  const f = await fixture({ providerTimeoutMs: 30, modelProvider: { version: 'synthetic-timeout-v1', generate: () => new Promise(() => {}) } });
  const r = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(r.status, 504); assert.equal(r.error, 'PROVIDER_TIMEOUT'); assert.equal(f.state.charged.length, 1);
});
test('budget refusal starts no model call and does not expose partial evidence', async () => {
  const f = await fixture(); f.state.budgetAllowed = false; const r = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(r.status, 429); assert.equal(f.state.modelCalls, 0); assert.equal(r.citations, undefined);
});
test('concurrent service limit rejects excess work and recovers after completion', async () => {
  let release; const gate = new Promise(r => { release = r; }), f = await fixture({ maxConcurrent: 1 }); f.state.onLexical = () => gate;
  const pending = f.service.search({ request: f.request, query: '每天阅读' });
  const overflow = await f.service.search({ request: f.request, query: '每天阅读' }); assert.equal(overflow.status, 429); release(); assert.equal((await pending).ok, true);
  f.state.onLexical = undefined; assert.equal((await f.service.search({ request: f.request, query: '每天阅读' })).ok, true);
});
test('recorded evidence graph has only checked source containment, never inferred lineage', async () => {
  const f = await fixture(), r = await f.service.search({ request: f.request, query: '每天阅读' }), graph = await f.service.relations({ request: f.request, citations: [r.items[0].citation] });
  assert.equal(graph.ok, true); assert.equal(graph.edges[0].relation, 'contains-recorded-segment'); assert.equal(graph.historicalRelationsInferred, false); assert.equal(graph.nodes[0].text, undefined);
  f.sources.get('fixture-a').rights.status = 'withdrawn'; assert.equal((await f.service.relations({ request: f.request, citations: [r.items[0].citation] })).status, 403);
});
test('index capacity, duplicate IDs and unknown runtime limits are explicit failures', async () => {
  const f = await fixture(), records = [...f.sources.values()];
  assert.throws(() => createLexicalRepository({ records: [records[0], records[0]], readCurrent() {}, revision: 'v' }), /INVALID_INDEX_RECORD/);
  assert.throws(() => createLexicalRepository({ records, readCurrent() {}, revision: 'v', maxCharacters: 1 }), /INDEX_CAPACITY_EXCEEDED/);
  assert.throws(() => createEvidenceSearch({ maxConcurrent: 0 }), /INVALID_SERVICE_LIMITS/);
});
test('nonvisible index documents cannot alter public BM25 statistics or returned score metadata', async () => {
  const f = await fixture(), visible = ['fixture-a', 'fixture-b'].map(id => f.sources.get(id)), hidden = [];
  for (let i = 0; i < 30; i++) { const text = '合成 '.repeat(50 + i); hidden.push({ ...f.sources.get('fixture-private'), editionId: 'hidden-' + i, text, segmentSha256: await sha256(text) }); }
  const a = createLexicalRepository({ records: visible, readCurrent: f.repository.readCurrent, revision: 'index-v1' }), b = createLexicalRepository({ records: [...visible, ...hidden], readCurrent: f.repository.readCurrent, revision: 'index-v2' });
  const input = { query: '合成', filters: {}, limit: 100, isEligible: async h => ['fixture-a', 'fixture-b'].includes(h.editionId) };
  assert.deepEqual(await a.lexical(input), await b.lexical(input));
  const r = await f.service.search({ request: f.request, query: '合成' }); assert.ok(r.items.length); assert.equal(r.items[0].score, undefined); assert.equal(r.items[0].rank, 1);
});
test('source/index fingerprint mismatch blocks stale searchable text and metadata', async () => {
  for (const mutate of [async r => { r.title = '已变更标题'; }, async r => { r.text = '完全不同的新合成内容'; r.segmentSha256 = await sha256(r.text); }]) {
    const f = await fixture(); await mutate(f.sources.get('fixture-a')); const r = await f.service.search({ request: f.request, query: '每天阅读' }); assert.equal(r.error, 'INDEX_SOURCE_CHANGED'); assert.equal(r.items, undefined);
  }
});
test('unscoped backends or providers that omit eligibility cannot activate hybrid retrieval', async () => {
  const f = await fixture(); f.repository.scopedRetrieval = false; assert.equal((await f.service.search({ request: f.request, query: '每天阅读' })).error, 'SCOPED_INDEX_REQUIRED');
  const g = await fixture({ semanticProvider: { version: 'unscoped-v1', search: async () => [] } }); assert.equal((await g.service.search({ request: g.request, query: '每天阅读', mode: 'hybrid' })).error, 'SCOPED_SEMANTIC_PROVIDER_REQUIRED');
  const h = await fixture(); h.repository.lexical = async () => [{ editionId: 'fixture-a', segmentId: 'p1', score: 1, sourceFingerprint: 'a'.repeat(64) }]; assert.equal((await h.service.search({ request: h.request, query: '每天阅读' })).error, 'INDEX_SCOPE_CONTRACT_VIOLATION');
});
test('an attempted budget settlement failure is not retried or silently released', async () => {
  const f = await fixture(); f.state.onCommit = () => { throw Error('synthetic budget unavailable'); };
  const r = await f.service.answer({ request: f.request, question: '每天阅读' }); assert.equal(r.status, 503); assert.equal(r.claims, undefined); assert.equal(f.state.charged.length, 1); assert.equal(f.state.released, 0);
});
