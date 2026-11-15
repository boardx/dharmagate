import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCanonSearch } from '../src/evidence-search/canon-adapter.mjs';
import { readingModel } from '../src/tei-browser-reader.mjs';
import { sha256 } from '../src/evidence-search/index.mjs';

async function setup(change = () => {}) {
  const rawBytes = new TextEncoder().encode('<synthetic-only/>'), sourceCommit = 'a'.repeat(40), sourceSha256 = await sha256('<synthetic-only/>');
  const document = { id: 'T01n0001', title: '合成检索测试，不是佛典', commit: sourceCommit, rawSha256: sourceSha256, aiTranslated: false, lines: [1,2].map(n => ({ id: 'T01n0001:synthetic'+n, locator: 'synthetic:'+n, juan: n, text: '合成阅读测试第'+n+'卷', anchorIds: [] })), notes: [], toc: [] };
  const pin = { id: document.id, sourceCommit, sourceSha256, readingSha256: await sha256(JSON.stringify(readingModel(document))), publicationEligible: true };
  const state = { allowed: true, revision: 'rights-1' };
  const config = { admissions: [pin], indexRevision: 'synthetic-index-1', readVerifiedUnit: async () => ({ rawBytes, document }), readRights: async () => ({ ...pin, status: 'active', public: true, display: true, search: state.allowed, revision: state.revision }) };
  change({config, document, pin, state, rawBytes});
  return { ...await createPublicCanonSearch(config), state, request: new Request('https://dharmagate.us/api/evidence-search/search') };
}
test('canonical adapter uses existing reading model, exact source pins and juan-local page links', async () => {
  const f = await setup(), r = await f.service.search({request:f.request, query:'合成阅读'});
  assert.equal(r.ok, true); assert.equal(r.items.length,2);
  assert.ok(r.items.find(x=>x.citation.segmentId.endsWith('2')).citation.readURL.includes('page=2'));
  assert.equal(f.scope.rag,false); assert.equal(f.scope.wholeCanonSearch,false);
});
test('current search withdrawal revokes an already indexed source and old citation', async () => {
  const f = await setup(), first = await f.service.search({request:f.request,query:'合成阅读'});
  f.state.allowed=false;
  assert.deepEqual((await f.service.search({request:f.request,query:'合成阅读'})).items,[]);
  assert.equal((await f.service.validateCitation({request:f.request,citation:first.items[0].citation})).status,403);
});
test('admission and independent current rights are mandatory, display does not grant RAG', async () => {
  await assert.rejects(setup(({pin})=>{pin.publicationEligible=false}),/CANON_ADMISSION_INVALID/);
  await assert.rejects(setup(({config})=>{config.readRights=async()=>({status:'active',display:true})}),/CANON_SEARCH_RIGHTS_DENIED/);
  const f=await setup(); assert.equal((await f.service.answer({request:f.request,question:'合成阅读'})).error,'ANSWER_POLICY_NOT_CONFIGURED'); assert.equal(f.service.capabilities.answer,false);
});
test('source bytes and reading content tampering cannot enter the index', async () => {
  await assert.rejects(setup(({config,document})=>{config.readVerifiedUnit=async()=>({rawBytes:new Uint8Array([1]),document})}),/CANON_ORIGINAL_HASH_MISMATCH/);
  await assert.rejects(setup(({document})=>{document.lines[0].text+='改动'}),/CANON_READING_HASH_MISMATCH/);
});
test('retained raw/document references cannot mutate the indexed snapshot during digest awaits', async t => {
  const digest=crypto.subtle.digest.bind(crypto.subtle); let attack, fired=0, remaining=0;
  t.mock.method(crypto.subtle,'digest',async (...args)=>{
    if(attack&&--remaining===0){const mutate=attack;attack=null;await Promise.resolve();mutate();fired++;}
    return digest(...args);
  });
  for(const stage of [1,2]) { const f=await setup(({config,document,rawBytes})=>{
    config.readVerifiedUnit=async()=>{
      remaining=stage; attack=()=>{rawBytes.fill(0);document.lines[0].text='恶意替换的非原文';document.title='恶意标题';document.lines[1].anchorIds.push('恶意锚');};
      return {rawBytes,document};
    };
  });
  const r=await f.service.search({request:f.request,query:'合成阅读'});
  assert.equal(r.items.length,2);
  assert.ok(r.items.every(x=>x.title==='合成检索测试，不是佛典'&&!x.snippet.includes('恶意')));
  } assert.equal(fired,2);
});
