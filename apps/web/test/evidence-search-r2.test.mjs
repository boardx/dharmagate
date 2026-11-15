import test from 'node:test';import assert from 'node:assert/strict';
import {boundedR2Bytes,createCanonSearchRuntime} from '../src/evidence-search/r2-runtime.mjs';
test('R2 advertised and streamed bounds, exact sizes and body types fail closed',async()=>{
 const bucket=(size,chunks)=>({get:async()=>({size,body:new ReadableStream({start(c){for(const v of chunks)c.enqueue(v);c.close()}})})});
 assert.deepEqual(await boundedR2Bytes(bucket(2,[new Uint8Array([1]),new Uint8Array([2])]),'x',2),new Uint8Array([1,2]));
 for(const [size,chunks,max]of [[3,[],2],[1,[new Uint8Array(2)],4],[2,[new Uint8Array(1)],4],[1,['x'],4]])await assert.rejects(boundedR2Bytes(bucket(size,chunks),'x',max));
});
test('runtime leaves unrelated/RSC routes intact and denies CSRF/oversized body before R2',async()=>{
 let reads=0;const app=createCanonSearchRuntime({currentWorker:{fetch:async()=>new Response('retained')},edition:{id:'T08n0251'},approvalKey:'canon/approvals/literal/T08n0251.json'}),env={CANON_STORAGE:{get:async()=>{reads++;return null}}};
 assert.equal(await(await app.fetch(new Request('https://dharmagate.us/zh/library'),env)).text(),'retained');
 assert.equal(await(await app.fetch(new Request('https://dharmagate.us/resources/search',{headers:{rsc:'1'}}),env)).text(),'retained');
 assert.equal((await app.fetch(new Request('https://dharmagate.us/api/evidence-search/search',{method:'POST',body:'{}'}),env)).status,403);
 const headers={origin:'https://dharmagate.us','sec-fetch-site':'same-origin','x-dg-evidence-request':'1','content-type':'application/json'};
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(8193));c.close()}});
 assert.equal((await app.fetch(new Request('https://dharmagate.us/api/evidence-search/search',{method:'POST',headers,body,duplex:'half'}),env)).status,413);assert.equal(reads,0);
});
