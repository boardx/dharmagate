import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fixture } from './evidence-search-synthetic-fixture.mjs';
import { createEvidenceSearchHandler, SEARCH_PAGE_PATH, SEARCH_CLIENT_PATH, SEARCH_STYLE_PATH, SEARCH_CLIENT, SEARCH_CSS, searchPage } from '../src/evidence-search/http.mjs';

const base = 'https://dharmagate.us';
function request(path, value, extra = {}) {
  const headers = { origin: base, 'sec-fetch-site': 'same-origin', 'x-dg-evidence-request': '1', 'content-type': 'application/json', ...extra.headers };
  return new Request(base + path, { method: 'POST', headers, body: JSON.stringify(value), ...extra, ...(extra.headers ? { headers } : {}) });
}
async function setup() { const f = await fixture(); return { ...f, app: createEvidenceSearchHandler({ service: f.service, enabled: true, scopeLabel: '明确合成测试范围，不是生产馆藏。' }) }; }

test('only exact new owned paths are handled; legacy auth, private corpus and unknown nested paths remain unowned', async () => {
  const f = await setup();
  for (const path of ['/zh/login', '/api/resources/library/search', '/canon/zh', '/resources/library', '/api/evidence-search/search/private', '/admin', '/api/evidence-search/search.json']) assert.equal(await f.app.fetch(new Request(base + path)), null);
});
test('default disabled and unconfigured/disabled core cannot expose a working-looking search page', async () => {
  assert.equal((await createEvidenceSearchHandler().fetch(new Request(base + SEARCH_PAGE_PATH))).status, 503);
  const f = await fixture({ enabled: false }); assert.equal((await createEvidenceSearchHandler({ enabled: true, service: f.service }).fetch(new Request(base + SEARCH_PAGE_PATH))).status, 503);
});
test('SSR uses existing unified nine navigation, escaped scope, no inline script/style and no registered-account dependency', async () => {
  const f = await setup(), r = await f.app.fetch(new Request(base + SEARCH_PAGE_PATH)), html = await r.text();
  assert.equal(r.status, 200); assert.match(html, /data-dg-unified-nav/); assert.match(html, /href="\/zh\/library" aria-current="page"/); assert.match(html, /id="query"/); assert.match(html, /maxlength="160"/);
  assert.ok(!html.includes('onclick=')); assert.ok(!html.includes('<style')); assert.match(html, /<script src="\/_evidence-search\/client.js" defer>/);
  assert.equal(r.headers.get('content-security-policy'), "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  assert.equal(r.headers.get('set-cookie'), null); assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.ok(searchPage({ scopeLabel: '<img src=x onerror=alert(1)>' }).includes('&lt;img'));
});
test('RSC/prefetch requests are not substituted with HTML and HEAD is bodyless', async () => {
  const f = await setup();
  assert.equal(await f.app.fetch(new Request(base + SEARCH_PAGE_PATH, { headers: { rsc: '1' } })), null);
  const r = await f.app.fetch(new Request(base + SEARCH_PAGE_PATH, { method: 'HEAD' })); assert.equal(r.status, 200); assert.equal(await r.text(), '');
});
test('no-JavaScript fallback explicitly POSTs without query URL and fails safely before search',async()=>{
 const f=await setup(),html=await(await f.app.fetch(new Request(base+SEARCH_PAGE_PATH))).text();
 assert.match(html,/<form id="search-form" method="post" action="\/resources\/search">/);assert.match(html,/<input[^>]*name="query"/);assert.match(html,/<noscript>/);
 const target=new URL('/resources/search',base);assert.equal(target.search,'');
 const response=await f.app.fetch(new Request(target,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'query=private-nojs-query'}));
 assert.equal(response.status,405);assert.equal(response.headers.get('location'),null);assert.equal(f.state.lexicalCalls,0);assert.ok(!(await response.text()).includes('private-nojs-query'));
});
test('exact stylesheet/client bytes have private no-store, bodyless HEAD and supported methods', async () => {
  const app = createEvidenceSearchHandler();
  for (const [path, text] of [[SEARCH_CLIENT_PATH, SEARCH_CLIENT], [SEARCH_STYLE_PATH, SEARCH_CSS]]) {
    const r = await app.fetch(new Request(base + path)); assert.equal(await r.text(), text); assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.equal(await (await app.fetch(new Request(base + path, { method: 'HEAD' }))).text(), '');
    const denied = await app.fetch(new Request(base + path, { method: 'POST' })); assert.equal(denied.status, 405); assert.equal(denied.headers.get('allow'), 'GET, HEAD');
  }
  new vm.Script(SEARCH_CLIENT); assert.ok(!SEARCH_CLIENT.includes('innerHTML')); assert.ok(!SEARCH_CLIENT.includes('localStorage')); assert.ok(!SEARCH_CLIENT.includes('history.pushState')); assert.ok(SEARCH_CSS.includes('prefers-reduced-motion'));
});
test('POST search actually calls the scoped engine and returns only currently permitted source records', async () => {
  const f = await setup(), r = await f.app.fetch(request('/api/evidence-search/search', { query: '每天阅读' })), body = await r.json();
  assert.equal(r.status, 200); assert.equal(body.items.length, 1); assert.equal(body.items[0].citation.editionId, 'fixture-a'); assert.equal(body.items[0].score, undefined); assert.equal(r.headers.get('access-control-allow-origin'), null);
});
test('cross-origin, subdomain, absent fetch metadata/header and wrong content type cannot query', async () => {
  const f = await setup();
  for (const headers of [{ origin: 'https://evil.example' }, { origin: 'https://sub.dharmagate.us' }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': '' }, { 'x-dg-evidence-request': '' }, { 'content-type': 'text/plain' }]) {
    const r = await f.app.fetch(request('/api/evidence-search/search', { query: '每天阅读' }, { headers })); assert.equal(r.status, 403);
  }
  assert.equal(f.state.lexicalCalls, 0);
});
test('query strings, client identity and wrong methods fail before engine access', async () => {
  const f = await setup();
  assert.equal((await f.app.fetch(request('/api/evidence-search/search?q=private', { query: '每天阅读' }))).status, 400);
  assert.equal((await f.app.fetch(request('/api/evidence-search/search', { query: '每天阅读', principalId: 'admin' }))).status, 400);
  const r = await f.app.fetch(new Request(base + '/api/evidence-search/search')); assert.equal(r.status, 405); assert.equal(r.headers.get('allow'), 'POST'); assert.equal(f.state.lexicalCalls, 0);
});
test('streamed byte limit and malformed UTF8/JSON reject without trusting Content-Length', async () => {
  const f = await setup(), headers = { origin: base, 'sec-fetch-site': 'same-origin', 'x-dg-evidence-request': '1', 'content-type': 'application/json' };
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(5000)); c.enqueue(new Uint8Array(5000)); c.close(); } });
  assert.equal((await f.app.fetch(new Request(base + '/api/evidence-search/search', { method: 'POST', headers, body: stream, duplex: 'half' }))).status, 413);
  for (const body of ['not-json', '[]', '{}', '{"query":"每天阅读","role":"admin"}']) assert.equal((await f.app.fetch(new Request(base + '/api/evidence-search/search', { method: 'POST', headers, body }))).status, 400);
  assert.equal((await f.app.fetch(new Request(base + '/api/evidence-search/search', { method: 'POST', headers, body: new Uint8Array([0xff, 0xfe]) }))).status, 400);
});
test('HTTP citation/current-rights validation refuses a withdrawn source even after prior successful lookup', async () => {
  const f = await setup(), search = await (await f.app.fetch(request('/api/evidence-search/search', { query: '每天阅读' }))).json(), citation = search.items[0].citation;
  assert.equal((await f.app.fetch(request('/api/evidence-search/citation', { citation, quote: '合成测试' }))).status, 200);
  f.sources.get('fixture-a').rights.status = 'withdrawn';
  const denied = await f.app.fetch(request('/api/evidence-search/citation', { citation })); assert.equal(denied.status, 403); assert.equal((await denied.json()).citation, undefined);
});
test('HTTP provider absence is honest and synthetic draft endpoint is not presented as semantic acceptance', async () => {
  const f = await setup(), r = await f.app.fetch(request('/api/evidence-search/answer', { question: '每天阅读' })), draft = await r.json();
  assert.equal(r.status, 200); assert.equal(draft.kind, 'evidence-draft'); assert.equal(draft.semanticSupportAssessed, false);
  const g = await fixture({ modelProvider: undefined }), app = createEvidenceSearchHandler({ enabled: true, service: g.service });
  const failed = await app.fetch(request('/api/evidence-search/answer', { question: '每天阅读' })); assert.equal(failed.status, 503); assert.equal((await failed.json()).error, 'MODEL_NOT_CONFIGURED');
});
