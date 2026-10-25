import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/create-router.mjs';

test('new document entry paths support GET/HEAD without invoking legacy', async () => {
  const router = createRouter({ fetch() { throw Error('legacy must not run'); } }, '<main>new landing</main>');
  for (const path of ['/', '/bodi', '/bodi/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await router.fetch(new Request(`https://example.invalid${path}`, { method }), {}, {});
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(await res.text(), method === 'HEAD' ? '' : '<main>new landing</main>');
    }
  }
});

test('legacy requests preserve object identity, body, callbacks and execution bindings', async () => {
  const env = Object.freeze({ testOnly: true });
  const ctx = Object.freeze({ testOnly: true });
  const res = new Response('legacy');
  let expected;
  const router = createRouter({ fetch(req, e, c) {
    assert.equal(req, expected); assert.equal(e, env); assert.equal(c, ctx); return res;
  } }, 'new');
  for (const path of ['/zh', '/en/agents/Zen', '/zh/library', '/zh/articles', '/api/auth/callback/provider', '/ws/realtime', '/_next/static/file.js', '/unknown']) {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      expected = new Request(`https://example.invalid${path}?preserve=1`, {
        method, headers: { 'x-test': 'preserve' }, ...(method === 'GET' ? {} : { body: 'preserve body' })
      });
      assert.equal(await router.fetch(expected, env, ctx), res);
    }
  }
});

test('root mutations and RSC navigation remain on legacy', async () => {
  const res = new Response('legacy'); let count = 0;
  const router = createRouter({ fetch() { count++; return res; } }, 'new');
  for (const options of [{method:'POST',body:'action'}, {headers:{RSC:'1'}}, {headers:{'Next-Router-State-Tree':'tree'}}])
    assert.equal(await router.fetch(new Request('https://example.invalid/', options), {}, {}), res);
  assert.equal(count, 3);
});
