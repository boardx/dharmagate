// Explicit local input only. This is a validation driver, never a production grant.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createPublicCanonSearch} from '../../apps/web/src/evidence-search/canon-adapter.mjs';
import {readingModel} from '../../apps/web/src/tei-browser-reader.mjs';
import {sha256} from '../../apps/web/src/evidence-search/index.mjs';
import {createRetainedSearchWorker} from '../../apps/web/src/evidence-search/retained-worker.mjs';
import http from 'node:http';
import {createStoredCanonSearch} from '../../apps/web/src/evidence-search/stored-canon.mjs';
const [rawPath,documentPath,cataloguePath,unit]=process.argv.slice(2);
if(!rawPath||!documentPath||!cataloguePath||unit!=='T08n0251')throw Error('EXPLICIT_SINGLE_UNIT_INPUTS_REQUIRED');
const rawBytes=new Uint8Array(await fs.readFile(rawPath)),document=JSON.parse(await fs.readFile(documentPath,'utf8')),catalogue=JSON.parse(await fs.readFile(cataloguePath,'utf8')),row=catalogue.items.find(r=>r.id===unit);
assert.equal(row.publicationEligible,true);assert.equal(row.rightsEligible,true);assert.equal(row.license,'CC BY-NC-SA 4.0');assert.deepEqual(row.qualityWarnings,[]);
assert.equal(await sha256(JSON.stringify(readingModel(document))),row.readingSha256);
const pin={id:unit,sourceCommit:catalogue.commit,sourceSha256:row.rawSha256,readingSha256:row.readingSha256,publicationEligible:true};
let withdrawn=false;
const approvedIndex=process.argv.indexOf('--approved'),approved=approvedIndex!==-1;
const descriptor=approved?JSON.parse(await fs.readFile(process.argv[approvedIndex+1],'utf8')):null,approvalPath=approved?process.argv[approvedIndex+2]:null;
const admitted=approved?await createStoredCanonSearch({edition:descriptor,readObject:async key=>key===descriptor.rawKey?rawBytes:key===descriptor.documentKey?new Uint8Array(await fs.readFile(documentPath)):null,readApproval:async()=>{const record=JSON.parse(await fs.readFile(approvalPath,'utf8'));return withdrawn?{...record,status:'withdrawn'}:record}}):await createPublicCanonSearch({admissions:[pin],indexRevision:'explicit-local-validation:'+catalogue.commit,readVerifiedUnit:async()=>({rawBytes,document}),readRights:async()=>({...pin,status:withdrawn?'withdrawn':'active',public:true,display:true,search:true,revision:'validation-only:cbeta-nc-sa4:'+row.rawSha256})});
// search:true here tests the proposed license interpretation; it is NOT a stored
// production grant. Root reviews official terms, scope and notices before enabling.
const app=createRetainedSearchWorker({currentWorker:{fetch:()=>new Response('retained')},admittedSearch:admitted,scopeLabel:'CBETA《心經》T08n0251；唐玄奘譯；CC BY-NC-SA 4.0；非商業；技術索引未改正文，完整原出版聲明見原件。'});
const headers={origin:'https://dharmagate.us','sec-fetch-site':'same-origin','x-dg-evidence-request':'1','content-type':'application/json'};
let server,base;
if(process.argv.includes('--loopback')){
 server=http.createServer(async(req,res)=>{try{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>8192){res.writeHead(413);res.end();return}chunks.push(c)}const r=await app.fetch(new Request('https://dharmagate.us'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end()}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});base='http://127.0.0.1:'+server.address().port;
}
const call=(path,body)=>base?fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)}):app.fetch(new Request('https://dharmagate.us'+path,{method:'POST',headers,body:JSON.stringify(body)}));
try { const r=await call('/api/evidence-search/search',{query:'觀自在'});assert.equal(r.status,200);const result=await r.json();assert.ok(result.items.length>0);
for(const hit of result.items){const original=document.lines.find(l=>l.id===hit.citation.segmentId);assert.ok(original);assert.equal(hit.citation.segmentSha256,await sha256(original.text));assert.ok(hit.citation.readURL.endsWith('#'+encodeURIComponent(original.id)));}
const valid=await call('/api/evidence-search/citation',{citation:result.items[0].citation});assert.equal(valid.status,200);
withdrawn=true;assert.equal((await call('/api/evidence-search/citation',{citation:result.items[0].citation})).status,403);
assert.equal(await(await app.fetch(new Request('https://dharmagate.us/'))).text(),'retained');
console.log(JSON.stringify({unit,commit:catalogue.commit,rawSHA256:row.rawSha256,readingSHA256:row.readingSha256,realSourceMatched:true,citationValidated:true,currentWithdrawalRejected:true,retainedRootPreserved:true,networkLoopback:!!base,modelCalls:0,productionReady:false,licenseInterpretationPendingRootReview:!approved,approvedStoredAdapter:approved}));
} finally {if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
