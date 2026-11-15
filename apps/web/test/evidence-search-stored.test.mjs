import test from 'node:test';import assert from 'node:assert/strict';
import {createStoredCanonSearch} from '../src/evidence-search/stored-canon.mjs';
import {sha256} from '../src/evidence-search/index.mjs';import {readingModel} from '../src/tei-browser-reader.mjs';
async function fixture(){
 const id='T08n0251',commit='a'.repeat(40),raw='<synthetic/>',rawSHA=await sha256(raw),doc={id,title:'纯合成存储测试',commit,rawSha256:rawSHA,sourceHeaderXml:'Available for non-commercial use when distributed with this header intact.',aiTranslated:false,lines:[{id:id+':test',locator:'test',juan:'1',text:'合成索引测试',anchorIds:[]}],notes:[],toc:[]},encoded=JSON.stringify(doc),prefix='canon/'+commit+'/'+id+'/';
 const edition={id,sourceCommit:commit,sourceSha256:rawSHA,readingSha256:await sha256(JSON.stringify(readingModel(doc))),documentSha256:await sha256(encoded),rawKey:prefix+'source.xml',documentKey:prefix+'reading.json'},record={...edition,status:'active',literalIndex:true,unchangedShortSnippet:true,nonCommercial:true,noticeAndVersionAccessible:true,license:'CC BY-NC-SA 4.0',rag:false,embedding:false,training:false,revision:'synthetic-review'};
 const reads=[],objects=new Map([[edition.rawKey,new TextEncoder().encode(raw)],[edition.documentKey,new TextEncoder().encode(encoded)]]);return{edition,record,objects,reads,config:{edition,readObject:async key=>{reads.push(key);return objects.get(key)},readApproval:async()=>record}};
}
test('stored adapter is single-unit, exact objects and freshly reviewed search only',async()=>{
 const f=await fixture(),app=await createStoredCanonSearch(f.config),request=new Request('https://dharmagate.us/');assert.deepEqual(f.reads,[f.edition.rawKey,f.edition.documentKey]);assert.equal((await app.service.search({request,query:'合成索引'})).items.length,1);f.record.literalIndex=false;assert.deepEqual((await app.service.search({request,query:'合成索引'})).items,[]);
});
test('missing notices, model grants, wrong version and denied approvals fail before object reads',async()=>{
 for(const change of [r=>r.status='withdrawn',r=>r.status='denied',r=>r.nonCommercial=false,r=>r.noticeAndVersionAccessible=false,r=>r.rag=true,r=>r.sourceSha256='b'.repeat(64),r=>r.revision='']){const f=await fixture();change(f.record);await assert.rejects(createStoredCanonSearch(f.config));assert.equal(f.reads.length,0);}
 const f=await fixture();f.edition.id='PRIVATE_FIRST10';await assert.rejects(createStoredCanonSearch(f.config));
});
test('mutated stored reading document cannot bypass its whole-document pin',async()=>{
 const f=await fixture();f.objects.set(f.edition.documentKey,new TextEncoder().encode('{}'));await assert.rejects(createStoredCanonSearch(f.config),/DOCUMENT_HASH_MISMATCH/);
});
