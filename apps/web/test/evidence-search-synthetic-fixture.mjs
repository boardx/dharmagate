import { createEvidenceSearch, createLexicalRepository, sha256, sourceFingerprint } from '../src/evidence-search/index.mjs';

// Entirely synthetic records. No real canon, account, token or private corpus is read.
export async function fixture(options = {}) {
  const texts = [
    ['fixture-a', '合成资料甲', '这是一段合成测试。每天阅读，练习安静观察。'],
    ['fixture-b', '合成资料乙', '这段合成数据谈到窗外风声和缓慢呼吸。'],
    ['fixture-private', '合成私有测试', '每天阅读的私人合成记录。'],
    ['fixture-withdrawn', '合成撤回测试', '每天阅读的已撤回合成记录。'],
  ];
  const sources = new Map();
  for (const [editionId, title, text] of texts) sources.set(editionId, {
    editionId, segmentId: 'p1', title, text, language: 'zh', collection: 'TEST',
    version: 'synthetic-v1', sourceCommit: 'a'.repeat(40), sourceSha256: await sha256('explicit synthetic source ' + editionId), segmentSha256: await sha256(text),
    locator: '合成段落 p1', sourceURL: 'https://example.org/synthetic/' + editionId, readURL: '/canon/zh?unit=' + editionId + '#p1',
    rights: { status: editionId === 'fixture-withdrawn' ? 'withdrawn' : 'active', revision: 'rights-v1', display: true, search: true, embedding: true, rag: true },
  });
  const state = { actor: 'synthetic-reader-a', authRevision: 'auth-v1', allowed: true, reads: 0, sourceAuth: 0, lexicalCalls: 0, semanticCalls: 0, modelCalls: 0, charged: [], released: 0, reservations: 0, lastModelEvidence: null };
  const acl = new Map([['synthetic-reader-a', new Set(['fixture-a', 'fixture-b', 'fixture-withdrawn'])], ['synthetic-reader-b', new Set(['fixture-private'])]]);
  const records = [...sources.values()], fingerprints = new Map(await Promise.all([...sources].map(async ([id, r]) => [id, await sourceFingerprint(r)])));
  const original = createLexicalRepository({ records, revision: 'synthetic-index-v1', async readCurrent({ editionId }) { state.reads++; const value = sources.has(editionId) ? structuredClone(sources.get(editionId)) : null; await state.onRead?.(editionId, state.reads); return value; } });
  const repository = { revision: original.revision, scopedRetrieval: true, readCurrent: original.readCurrent, async lexical(input) { state.lexicalCalls++; await state.onLexical?.(); return original.lexical(input); } };
  const authorizeRequest = async (_request, context) => {
    await state.onAuth?.(context);
    if (context.editionId) state.sourceAuth++;
    return { allow: state.allowed, principalId: state.actor, revision: state.authRevision, resourceAuthorized: context.editionId ? acl.get(state.actor)?.has(context.editionId) === true : undefined };
  };
  const semanticProvider = { version: 'synthetic-vector-v1', scopedRetrieval: true, async search(input) { state.semanticCalls++; const values = state.semanticResults ?? [{ editionId: 'fixture-b', segmentId: 'p1', score: 0.9 }, { editionId: 'fixture-a', segmentId: 'p1', score: 0.8 }]; const visible = []; for (const x of values) { const h = { ...x, sourceFingerprint: x.sourceFingerprint ?? fingerprints.get(x.editionId) }; if (await input.isEligible(h)) visible.push(h); } return visible; } };
  const modelProvider = { version: 'synthetic-model-v1', async generate(input) { state.modelCalls++; state.lastModelEvidence = input.evidence; await state.onGenerate?.(); return state.draft ?? { claims: [{ text: '这是一条合成模型草稿，不是佛典。', evidence: [{ id: input.evidence[0].id, quote: input.evidence[0].text.slice(0, 8) }] }] }; } };
  const budget = { async reserve() { state.reservations++; return { allowed: state.budgetAllowed !== false, async commit(meta) { state.charged.push(meta.outcome); await state.onCommit?.(); }, async release() { state.released++; } }; } };
  const config = { enabled: true, repository, authorizeRequest, semanticProvider, modelProvider, budget, answerPolicy: async () => ({ allow: state.policyAllowed !== false, version: 'synthetic-policy-v1' }), ...options };
  const service = createEvidenceSearch(config);
  const request = new Request('https://dharmagate.us/api/evidence-search/search');
  return { service, sources, state, repository, semanticProvider, modelProvider, authorizeRequest, request, config, acl };
}

