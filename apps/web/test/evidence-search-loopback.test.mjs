import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fixture } from './evidence-search-synthetic-fixture.mjs';
import { createEvidenceSearchHandler } from '../src/evidence-search/http.mjs';

test('actual loopback HTTP carries scoped search, citation revocation and CSRF denial', async () => {
  const f=await fixture(), handler=createEvidenceSearchHandler({service:f.service,enabled:true,scopeLabel:'合成网络回归；非真实佛典'});
  // Test driver only: canonical URL reconstruction is not a production reverse proxy.
  const server=http.createServer(async(req,res)=>{
    const chunks=[]; for await(const chunk of req) chunks.push(chunk);
    const request=new Request('https://dharmagate.us'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
    const response=await handler.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    const page=await fetch(base+'/resources/search'); assert.equal(page.status,200);assert.ok((await page.text()).includes('合成网络回归'));
    const headers={'origin':'https://dharmagate.us','sec-fetch-site':'same-origin','x-dg-evidence-request':'1','content-type':'application/json'};
    const post=(path,body,h=headers)=>fetch(base+path,{method:'POST',headers:h,body:JSON.stringify(body)});
    const result=await post('/api/evidence-search/search',{query:'每天阅读'}); assert.equal(result.status,200);
    const body=await result.json();assert.equal(body.items.length,1);assert.equal(result.headers.get('cache-control'),'private, no-store');
    assert.equal((await post('/api/evidence-search/search',{query:'每天阅读'},{...headers,origin:'https://evil.example'})).status,403);
    f.sources.get('fixture-a').rights.status='withdrawn';
    assert.equal((await post('/api/evidence-search/citation',{citation:body.items[0].citation})).status,403);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
