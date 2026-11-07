import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createFullCanonLibrary} from '../src/full-canon-library.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture({corrupt=false,eligible=true,truncate=false,mutatePage=()=>{},wrongUnit=false}={}){
 const commit='a'.repeat(40),prefix='canon/'+commit+'/',key=prefix+'shards/00001.bin',pieces=[];let offset=0;
 const record=(data)=>{const raw=Buffer.from(typeof data==='string'?data:JSON.stringify(data)),b=gzipSync(raw),r={key,range:{offset,length:b.length},bytes:b.length,sha256:sha(b),encoding:'gzip',decodedBytes:raw.length,decodedSha256:sha(raw)};pieces.push(b);offset+=b.length;return r};
 const source=record('<TEI><teiHeader>non-commercial</teiHeader><text>如是我聞</text></TEI>');
 const page=record({unit:'T01n0001',page:1,juan:'1',lines:[{id:'T01n0001:0001a01',text:'如是我聞'}],annotations:[],aiTranslated:false});
 mutatePage(page);
 const manifest=record({id:wrongUnit?'T01n0002':'T01n0001',commit,title:'長阿含經',authors:['譯者'],pages:[page],sourceObject:source,publicationEligible:eligible,rightsEligible:eligible,qualityWarnings:[]});
 const catalogueRaw=Buffer.from(JSON.stringify({commit,sourceUnits:1,workIdentifiers:1,collectionCounts:{T:1},items:[{id:'T01n0001',collection:'T',title:'長阿含經',authors:['譯者'],manifest}]})),catalogueEncoded=gzipSync(catalogueRaw);
 const catalogue={key:prefix+'catalogue.json.gz',bytes:catalogueEncoded.length,sha256:sha(catalogueEncoded),encoding:'gzip',decodedBytes:catalogueRaw.length,decodedSha256:sha(catalogueRaw)};
 const shard=Buffer.concat(pieces),map=new Map([[key,shard],[catalogue.key,catalogueEncoded]]),calls=[];
 const read=async(k,options)=>{calls.push([k,options]);let bytes=map.get(k);if(!bytes)return null;const size=bytes.length;if(options?.range)bytes=bytes.subarray(options.range.offset,options.range.offset+options.range.length);if(corrupt)bytes=Buffer.alloc(bytes.length);if(truncate)bytes=bytes.subarray(0,bytes.length-1);return {size,body:new Blob([bytes]).stream()}};
 const md5=createHash('md5').update(shard).digest('hex');read.head=async k=>({size:map.get(k)?.length,etag:md5});
 const app=createFullCanonLibrary({bootstrap:{commit,catalogue,sourceUnits:1,shards:[{key,bytes:shard.length,md5}]}});
 const fetch=(path,method='GET')=>app.fetch(new Request('https://example.com'+path,{method}),read);return {fetch,calls};
}
test('range gzip catalogue and original Chinese page verified',async()=>{const {fetch,calls}=fixture();const c=await (await fetch('/canon/zh/api/catalogue')).json();assert.equal(c.sourceUnits,1);const p=await (await fetch('/canon/zh/api/page/T01n0001')).json();assert.equal(p.lines[0].text,'如是我聞');assert.ok(calls.some(c=>c[1]?.range));});
test('original XML remains lossless attachment',async()=>{const r=await fixture().fetch('/canon/zh/api/source/T01n0001');assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment/);assert.match(await r.text(),/如是我聞/);});
test('corrupt storage fails closed',async()=>assert.equal((await fixture({corrupt:true}).fetch('/canon/zh/api/catalogue')).status,503));
test('unreviewed view and unconfirmed source rights denied',async()=>{const f=fixture({eligible:false});assert.equal((await f.fetch('/canon/zh/api/page/T01n0001')).status,409);assert.equal((await f.fetch('/canon/zh/api/source/T01n0001')).status,409);});
test('unknown namespace does not take legacy ownership; owned unknown never falls back',async()=>{const f=fixture();assert.equal(await f.fetch('/research'),null);assert.equal((await f.fetch('/canon/zh/unknown')).status,404);assert.equal((await f.fetch('/canon/zh/api/unit/../../secret')).status,404);assert.equal((await f.fetch('/canon/zh','POST')).status,405);});
test('fixed shard status only permits approved index',async()=>{const f=fixture();assert.equal((await (await f.fetch('/canon/zh/api/release-status?shard=0')).json()).verified,true);assert.equal((await f.fetch('/canon/zh/api/release-status?shard=99')).status,400);});
test('missing binding is unavailable without fallback',async()=>{const app=createFullCanonLibrary({bootstrap:{commit:'a'.repeat(40)}});assert.equal((await app.fetch(new Request('https://example.com/canon/zh/api/catalogue'))).status,503)});

test('truncated storage stream rejected',async()=>assert.equal((await fixture({truncate:true}).fetch('/canon/zh/api/catalogue')).status,503));
for(const [name,mutatePage]of [
 ['negative range',p=>p.range.offset=-1],
 ['oversize range',p=>p.range.length=64*1024*1024+1],
 ['decoded overflow',p=>p.decodedBytes=1],
 ['decoded hash',p=>p.decodedSha256='0'.repeat(64)],
 ['unknown codec',p=>p.encoding='br'],
 ['arbitrary key',p=>p.key='private/secret'],
 ['invalid gzip descriptor',p=>p.encoding='identity']
])test(name+' rejected without fallback',async()=>assert.equal((await fixture({mutatePage}).fetch('/canon/zh/api/page/T01n0001')).status,503));
test('cross-unit manifest rejected',async()=>assert.equal((await fixture({wrongUnit:true}).fetch('/canon/zh/api/page/T01n0001')).status,503));

test('simplified query finds traditional title without changing original',async()=>{const d=await(await fixture().fetch('/canon/zh/api/catalogue?q='+encodeURIComponent('长阿含经'))).json();assert.equal(d.items[0].title,'長阿含經')});

test('common short title and simplified query preserve authoritative full title',async()=>{
 const commit='8ebac86d00719479db5777dc6cd77ba111c3067a',row={id:'T08n0235',workId:'T0235',title:'金剛般若波羅蜜經',authors:['後秦 鳩摩羅什譯'],collection:'T',rightsEligible:true,readingSha256:'0'.repeat(64),sourceBytes:1,publicationEligible:true,pages:1,juan:['1']},raw=Buffer.from(JSON.stringify({commit,sourceUnits:1,workIdentifiers:1,collectionCounts:{T:1},items:[row]})),b=gzipSync(raw),record={key:'canon/'+commit+'/catalogue.gz',bytes:b.length,sha256:sha(b),encoding:'gzip',decodedBytes:raw.length,decodedSha256:sha(raw)},app=createFullCanonLibrary({bootstrap:{commit,sourceReader:true,sourceUnits:1,sourceBytesTotal:1,legacyStoredBytesUpperBound:0,counts:{T:1},catalogue:record},readObject:async()=>({size:b.length,body:new Blob([b]).stream()})});
 for(const q of ['金刚经','金剛經','金刚般若波罗蜜经']){const r=await app.fetch(new Request('https://example.com/canon/zh/api/catalogue?q='+encodeURIComponent(q))),d=await r.json();assert.equal(d.items[0]?.id,'T08n0235',q);assert.equal(d.items[0].title,'金剛般若波羅蜜經')}
});

test('latest catalogue request owns UI when responses arrive out of order',async()=>{
 const {runInNewContext}=await import('node:vm');const {fetch}=fixture();const script=await(await fetch('/canon/zh/client.js')).text(),elements=new Map(),pending=[];
 const element=()=>({value:'',textContent:'',children:[],append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){this.children=[...nodes]},setAttribute(){},classList:{toggle(){}}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 runInNewContext(script,{document:{getElementById:get,createElement:element},location:{href:'https://example.com/canon/zh?view=list'},URL,URLSearchParams,fetch:()=>new Promise(resolve=>pending.push(resolve))});
 assert.equal(pending.length,1);get('query').value='new';get('catalogue-search').onsubmit({preventDefault(){}});assert.equal(pending.length,2);
 const data=(id,title)=>({sourceUnits:1,workIdentifiers:1,filteredUnits:1,items:[{id,title,authors:[],extent:'1卷',publicationEligible:true}]});
 pending[1]({ok:true,json:async()=>data('T08n0235','最新結果')});await new Promise(setImmediate);const newest=get('status').textContent;assert.equal(get('catalogue').children[0].children[0].children[0].textContent,'最新結果');
 pending[0]({ok:true,json:async()=>data('T01n0001','過期結果')});await new Promise(setImmediate);assert.equal(get('status').textContent,newest);assert.equal(get('catalogue').children[0].children[0].children[0].textContent,'最新結果');
});
for(const [label,oldResponse]of [['500',{ok:false,json:async()=>({})}],['invalid JSON',{ok:true,json:async()=>{throw Error('old invalid JSON')}}]])test('old '+label+' never replaces newest successful result',async()=>{
 const {runInNewContext}=await import('node:vm'),script=await(await fixture().fetch('/canon/zh/client.js')).text(),elements=new Map(),pending=[];
 const element=()=>({value:'',textContent:'',children:[],append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){this.children=[...nodes]},setAttribute(){},classList:{toggle(){}}});const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 runInNewContext(script,{document:{getElementById:get,createElement:element},location:{href:'https://example.com/canon/zh?view=list'},URL,URLSearchParams,fetch:()=>new Promise(resolve=>pending.push(resolve))});get('query').value='new';get('catalogue-search').onsubmit({preventDefault(){}});
 pending[1]({ok:true,json:async()=>({sourceUnits:1,workIdentifiers:1,filteredUnits:0,items:[]})});await new Promise(setImmediate);const current=get('status').textContent;pending[0](oldResponse);await new Promise(setImmediate);assert.equal(get('status').textContent,current);
 get('catalogue-search').onsubmit({preventDefault(){}});pending[2]({ok:false});await new Promise(setImmediate);assert.match(get('status').textContent,/暫不可用/,'current error must still be shown');
});
