import test from 'node:test';
import assert from 'node:assert/strict';
import { createRetainedSearchWorker } from '../src/evidence-search/retained-worker.mjs';
import { fixture } from './evidence-search-synthetic-fixture.mjs';

test('missing source leaves the whole retained worker intact rather than a disabled placeholder page',async()=>{
  const seen=[],currentWorker={async fetch(...args){seen.push(args);return new Response('existing',{status:202,headers:{'x-retained':'1'}})}};
  const app=createRetainedSearchWorker({currentWorker});const env={},ctx={};
  for(const path of ['/','/canon/zh','/resources/search','/api/evidence-search/search','/api/auth/session','/assets/existing.png']){
    const request=new Request('https://dharmagate.us'+path),r=await app.fetch(request,env,ctx);
    assert.equal(r.status,202);assert.equal(await r.text(),'existing');assert.equal(seen.at(-1)[0],request);assert.equal(seen.at(-1)[1],env);assert.equal(seen.at(-1)[2],ctx);
  }
});
test('explicit source owns only new routes; denied owned requests never fall back',async()=>{
  const f=await fixture();let fallbacks=0;
  const app=createRetainedSearchWorker({currentWorker:{fetch(){fallbacks++;return new Response('legacy')}},admittedSearch:{service:f.service,scope:{kind:'explicit-public-canon-subset',rag:false,embedding:false}},scopeLabel:'合成整合测试'});
  const bad=new Request('https://dharmagate.us/api/evidence-search/search',{method:'POST',body:'{}'});
  assert.equal((await app.fetch(bad)).status,403);assert.equal(fallbacks,0);
  assert.equal((await app.fetch(new Request('https://dharmagate.us/resources/search'))).status,200);
  await app.fetch(new Request('https://dharmagate.us/api/private-search'));assert.equal(fallbacks,1);
  await app.fetch(new Request('https://dharmagate.us/resources/search',{headers:{rsc:'1'}}));assert.equal(fallbacks,2);
});
