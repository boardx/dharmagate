import test from 'node:test';import assert from 'node:assert/strict';import {createPracticePortalWorker,practicePortalClient,practicePortalHtml}from'../src/practice-portal.mjs';
const request=(path,method='GET',headers={})=>new Request('https://dharmagate.us'+path,{method,headers});
test('practice routes are delegated and existing nonportal/private pages remain unchanged',async()=>{
 const kept=new Response('existing private response',{status:401});let calls=0;const app=createPracticePortalWorker({fetch:async()=>{calls++;return kept}},{practice:{fetch:async r=>new URL(r.url).pathname==='/practice/timer'?new Response('timer'):null}});
 assert.equal(await(await app.fetch(request('/practice/timer'))).text(),'timer');assert.equal(calls,0);assert.equal(await app.fetch(request('/api/user/profile')),kept);assert.equal(calls,1);
});
test('portal is enhanced only for full HTML /zh GET, preserving CSP and clearing stale hashes',async()=>{
 let rewrites=0;const base={fetch:async()=>new Response('<main>Existing agents</main>',{headers:{'content-type':'text/html','etag':'old','content-security-policy':"default-src 'self'"}})},app=createPracticePortalWorker(base,{practice:{fetch:async()=>null},rewriteHtml:async(r,assets)=>{rewrites++;assert.equal(r.headers.get('etag'),null);assert.equal(r.headers.get('content-security-policy'),"default-src 'self'");assert.match(assets.html,/href="\/practice\/timer"/);return r}});
 await app.fetch(request('/zh'));assert.equal(rewrites,1);for(const r of [request('/'),request('/zh','HEAD'),request('/zh','GET',{rsc:'1'}),request('/zh','GET',{'next-router-state-tree':'synthetic'})])await app.fetch(r);assert.equal(rewrites,1);
});
test('portal assets are same-origin, no inline events or source HTML injection; writes rejected',async()=>{
 assert.doesNotThrow(()=>new Function(practicePortalClient));assert.ok(!practicePortalClient.includes('innerHTML'));assert.ok(!practicePortalClient.includes('fetch('));assert.match(practicePortalHtml,/声音体验/);
 const app=createPracticePortalWorker({fetch:async()=>new Response('base')},{practice:{fetch:async()=>null}});for(const path of ['/practice/portal.css','/practice/portal.js']){assert.equal((await app.fetch(request(path))).status,200);assert.equal((await app.fetch(request(path,'HEAD'))).body,null);assert.equal((await app.fetch(request(path,'POST'))).status,405)}
});
