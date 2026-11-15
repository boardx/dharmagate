// Local-only actual workerd/R2 integration. Explicit inputs; no network services.
import fs from 'node:fs/promises';import {CANON_CATALOGUE} from '../../apps/web/src/evidence-search/catalogue-rights.mjs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const [deps,out,descriptorPath,approvalPath,rawPath,documentPath,cataloguePath]=process.argv.slice(2);
if(!deps||!out||!descriptorPath||!approvalPath||!rawPath||!documentPath||!cataloguePath)throw Error('EXPLICIT_LOCAL_INPUTS_REQUIRED');
const {build}=await import(path.resolve(deps,'esbuild/lib/main.js')),{Miniflare}=await import(path.resolve(deps,'miniflare/dist/src/index.js'));
const descriptor=JSON.parse(await fs.readFile(descriptorPath,'utf8')),approval=JSON.parse(await fs.readFile(approvalPath,'utf8')),startUTC=new Date().toISOString();
await fs.mkdir(out,{recursive:true});
const source=`import {createCanonSearchRuntime} from ${JSON.stringify(path.resolve('apps/web/src/evidence-search/r2-runtime.mjs'))};let clock=0;const app=createCanonSearchRuntime({currentWorker:{fetch:async r=>new Response('retained:'+new URL(r.url).pathname)},edition:${JSON.stringify(descriptor)},approvalKey:'canon/approvals/literal/T08n0251.json',now:()=>clock});export default{async fetch(r,e,c){if(new URL(r.url).pathname==='/__test/expire'){clock=31000;return new Response('expired')}return app.fetch(r,e,c)}};`;
await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'local-fixture-only.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(out,'worker.mjs')});
let outbound=0;const mf=new Miniflare({host:'127.0.0.1',port:0,modules:true,scriptPath:path.resolve(out,'worker.mjs'),compatibilityDate:'2026-11-14',r2Buckets:['CANON_STORAGE'],outboundService:()=>{outbound++;return new Response('external disabled',{status:503})}}),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
try{
 const bucket=await mf.getR2Bucket('CANON_STORAGE'),approvalKey='canon/approvals/literal/T08n0251.json';
 const arrayBuffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 await bucket.put(CANON_CATALOGUE.key,arrayBuffer(await fs.readFile(cataloguePath)));
 await bucket.put(descriptor.rawKey,arrayBuffer(await fs.readFile(rawPath)));await bucket.put(descriptor.documentKey,arrayBuffer(await fs.readFile(documentPath)));await bucket.put(approvalKey,JSON.stringify(approval));
 const headers={origin:'https://dharmagate.us','sec-fetch-site':'same-origin','x-dg-evidence-request':'1','content-type':'application/json'},post=(operation,body)=>mf.dispatchFetch('https://dharmagate.us/api/evidence-search/'+operation,{method:'POST',headers,body:JSON.stringify(body)});
 const first=await post('search',{query:'觀自在'}),data=await first.json();check('actual workerd existing R2 source keyword',first.status===200&&data.items.length>0);check('actual original line locator',data.items.every(x=>x.citation.editionId==='T08n0251'&&x.citation.segmentId.startsWith('T08n0251:')));
 check('actual reference valid',(await post('citation',{citation:data.items[0].citation})).status===200);
 await bucket.delete(descriptor.rawKey);check('immutable artifact bytes TTL warm',(await post('search',{query:'觀自在'})).status===200);
 await bucket.put(approvalKey,JSON.stringify({...approval,status:'withdrawn',revision:'withdrawn-test'}));
 check('warm TTL cannot authorize revoked search',(await post('search',{query:'觀自在'})).status===503);check('warm TTL cannot authorize old citation',(await post('citation',{citation:data.items[0].citation})).status===503);
 await bucket.put(approvalKey,JSON.stringify({...approval,revision:'restored-test'}));check('new approval revision invalidates old citation',(await post('citation',{citation:data.items[0].citation})).status===409);
 await mf.dispatchFetch('https://dharmagate.us/__test/expire');check('expired artifact reload fails closed after missing raw',(await post('search',{query:'觀自在'})).status===503);
 check('retained existing route',(await(await mf.dispatchFetch('https://dharmagate.us/zh/library')).text())==='retained:/zh/library');check('unknown owned prefix remains retained',(await(await mf.dispatchFetch('https://dharmagate.us/_evidence-search/unknown')).text())==='retained:/_evidence-search/unknown');check('cross origin denied before R2',(await mf.dispatchFetch('https://dharmagate.us/api/evidence-search/search',{method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:'{}'})).status===403);
 check('external requests zero',outbound===0);
 const result={startUTC,endUTC:new Date().toISOString(),passed:checks.length,checks,realWorkerd:true,realLocalR2:true,realOriginal:true,modelCalls:0,outbound,workerSHA256:crypto.createHash('sha256').update(await fs.readFile(path.join(out,'worker.mjs'))).digest('hex'),testOnlyClockRouteNotProduction:true,productionReady:false};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await mf.dispose()}
