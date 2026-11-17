import test from 'node:test';import assert from 'node:assert/strict';
import {boundedR2Bytes,createCanonSearchRuntime} from '../src/evidence-search/r2-runtime.mjs';
import {readingModel} from '../src/tei-browser-reader.mjs';import {sha256} from '../src/evidence-search/index.mjs';
test('R2 advertised and streamed bounds, exact sizes and body types fail closed',async()=>{
 const bucket=(size,chunks)=>({get:async()=>({size,body:new ReadableStream({start(c){for(const v of chunks)c.enqueue(v);c.close()}})})});
 assert.deepEqual(await boundedR2Bytes(bucket(2,[new Uint8Array([1]),new Uint8Array([2])]),'x',2),new Uint8Array([1,2]));
 for(const [size,chunks,max]of [[3,[],2],[1,[new Uint8Array(2)],4],[2,[new Uint8Array(1)],4],[1,['x'],4]])await assert.rejects(boundedR2Bytes(bucket(size,chunks),'x',max));
});
test('72-line request snapshot caps delayed R2 reads, preserves midrequest and nextrequest revocation',async()=>{
 const id='T08n0251',commit='a'.repeat(40),raw='<synthetic-only/>',rawSHA=await sha256(raw),document={id,title:'純合成測試目錄',commit,rawSha256:rawSHA,aiTranslated:false,sourceHeaderXml:'Available for non-commercial use when distributed with this header intact.',lines:Array.from({length:72},(_,n)=>({id:id+':synthetic'+n,locator:'synthetic'+n,juan:'1',text:'合成索引測試段落'+n,anchorIds:[]})),notes:[],toc:[]},encoded=JSON.stringify(document),prefix='canon/'+commit+'/'+id+'/',approvalKey='canon/approvals/literal/T08n0251.json';
 const edition={id,sourceCommit:commit,sourceSha256:rawSHA,readingSha256:await sha256(JSON.stringify(readingModel(document))),documentSha256:await sha256(encoded),rawKey:prefix+'source.xml',documentKey:prefix+'reading.json'},originalApproval={...edition,status:'active',revision:'synthetic-approval',literalIndex:true,unchangedShortSnippet:true,nonCommercial:true,noticeAndVersionAccessible:true,license:'CC BY-NC-SA 4.0',rag:false,embedding:false,training:false};
 let approval=structuredClone(originalApproval),legacy={active:true,revision:'synthetic-legacy'},reads=0,approvalReads=0,catalogueReads=0,mutation=null;
 const encoder=new TextEncoder(),bucket={async get(key){reads++;if(reads>6)throw Error('R2 amplification regression');await new Promise(r=>setTimeout(r,50));let value;
  if(key===approvalKey){approvalReads++;if(approvalReads===2&&mutation==='approval')approval.status='withdrawn';if(approvalReads===2&&mutation==='same-revision')approval.literalIndex=false;value=JSON.stringify(approval)}
  else if(key==='synthetic-current-catalogue'){catalogueReads++;if(catalogueReads===2&&mutation==='catalogue')legacy.active=false;value=JSON.stringify(legacy)}
  else if(key===edition.rawKey)value=raw;else if(key===edition.documentKey)value=encoded;else return null;
  const bytes=encoder.encode(value);return {size:bytes.length,body:new Blob([bytes]).stream()};}};
 // Explicit synthetic authority adapter only. Production builder omits this
 // injection and uses the pinned compressed/decoded real CBETA catalogue.
 const verifyLegacyCatalogue=async(store,_pin,read)=>{const r=JSON.parse(new TextDecoder().decode(await read(store,'synthetic-current-catalogue',100)));if(!r.active)throw Error('legacy denied');return r.revision};
 const app=createCanonSearchRuntime({currentWorker:{fetch:async()=>new Response('retained')},edition,approvalKey,verifyLegacyCatalogue}),headers={origin:'https://dharmagate.us','sec-fetch-site':'same-origin','x-dg-evidence-request':'1','content-type':'application/json'};
 const query=async()=>{reads=approvalReads=catalogueReads=0;return app.fetch(new Request('https://dharmagate.us/api/evidence-search/search',{method:'POST',headers,body:JSON.stringify({query:'合成索引'})}),{CANON_STORAGE:bucket})};
 let result=await query();assert.equal(result.status,200);assert.equal(reads,6);assert.equal(approvalReads,2);assert.equal((await result.json()).items.length,10);
 result=await query();assert.equal(result.status,200);assert.equal(reads,4);assert.equal(approvalReads,2);
 for(const kind of ['approval','same-revision','catalogue']){approval=structuredClone(originalApproval);legacy={active:true,revision:'synthetic-legacy'};mutation=kind;assert.equal((await query()).status,503);mutation=null;assert.equal((await query()).status,503);assert.ok(reads<=2);}
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

for(const configured of [false,true])test('metadata runtime never initializes fulltext or storage, bridge configured='+configured,async()=>{
 const commit='a'.repeat(40),hash='b'.repeat(64),prefix='canon/'+commit+'/T08n0251/';
 const edition={id:'T08n0251',sourceCommit:commit,sourceSha256:hash,readingSha256:hash,documentSha256:hash,rawKey:prefix+'source.xml',documentKey:prefix+'reading.json'};
 const calls={get:0,bodyInitialization:0,legacyAuthority:0,bridge:0,fallback:0};
 const runtime=createCanonSearchRuntime({edition,approvalKey:'canon/approvals/literal/T08n0251.json',currentWorker:{fetch(){calls.fallback++;throw Error('SYNTHETIC_NO_FALLBACK')}},verifyLegacyCatalogue:async()=>{calls.legacyAuthority++;return 'synthetic-current'},...(configured?{citationMetadataBridge:{resolve(){calls.bridge++;throw Error('SYNTHETIC_NO_BRIDGE')}}}:{})});
 const bucket={async get(key){calls.get++;if(key===edition.rawKey||key===edition.documentKey)calls.bodyInitialization++;throw Error('SYNTHETIC_NO_STORAGE_OR_BODY')}};
 const response=await runtime.fetch(new Request('https://dharmagate.us/api/evidence-search/version-metadata',{method:'POST',headers:{origin:'https://dharmagate.us','sec-fetch-site':'same-origin','x-dg-evidence-request':'1','content-type':'application/json'},body:JSON.stringify({citation:{}})}),{CANON_STORAGE:bucket},{});
 assert.equal(response.status,503);assert.equal((await response.json()).error,'CITATION_METADATA_NOT_CONFIGURED');assert.deepEqual(calls,{get:0,bodyInitialization:0,legacyAuthority:0,bridge:0,fallback:0});
});
