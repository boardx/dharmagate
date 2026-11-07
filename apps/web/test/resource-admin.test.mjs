import test from 'node:test';
import assert from 'node:assert/strict';
import {createResourceAdmin} from '../src/resource-admin.mjs';
import {createAdminCsrf} from '../src/resource-admin-csrf.mjs';

// Explicit artificial identities/store. These are not legacy session validation.
const now=1900000000000;
const admin={sessionId:'fixture-session',user:{id:'fixture-admin',role:'admin'},expires:new Date(now+60000).toISOString()};
const base='https://example.test';
async function setup(session=admin){
 const csrf=await createAdminCsrf(crypto.getRandomValues(new Uint8Array(32)),{clock:()=>now});
 const item={id:'v1',title:'<script>fixture</script>',visibility:'private',sourceUrl:'https://example.org',contentVersion:'fixed',rights:{train:'deny'}};
 const seen=new Map(),audit=[];
 const store={listVersions:async()=>[item],getVersion:async id=>id==='v1'?item:null,
 listBatches:async()=>[{id:'b1',sourceId:'s1',status:'complete'}],listChecks:async()=>[{id:'c1',safeSummary:'sha256 verified',result:'pass'}],listAudit:async()=>audit,
 reviewRights:async review=>{if(review.versionId!=='v1')return 'missing';const value=JSON.stringify(review);if(seen.has(review.requestId))return seen.get(review.requestId)===value?'already-reviewed':'conflict';seen.set(review.requestId,value);item.rights[review.purpose]=review.decision;audit.push({id:review.requestId,resourceId:review.versionId,action:'rights-review'});return 'reviewed';}};
 const app=createResourceAdmin({readVerifiedLegacySession:async()=>session,store,csrf,clock:()=>now});
 const token=await csrf.issue(admin);
 const request=(path='/api/admin/resources/v1/rights',overrides={})=>new Request(base+path,{method:'POST',headers:{origin:base,'content-type':'application/x-www-form-urlencoded',...overrides.headers},body:new URLSearchParams({csrf:token,requestId:'r1',purpose:'display',decision:'allow',evidenceUrl:'https://example.org/license',...overrides.form})});
 return{app,request,store,csrf,token,item,audit};
}
test('unwired default refuses rather than trusting identity headers',async()=>{
 const r=await createResourceAdmin().fetch(new Request(base+'/api/admin/resources',{headers:{'x-role':'admin','x-user':'owner'}}));assert.equal(r.status,503);
});
test('anonymous, ordinary and expired sessions rejected',async()=>{
 for(const [identity,status] of [[null,401],[{...admin,user:{id:'member',role:'member'}},403],[{...admin,expires:new Date(now-1).toISOString()},401]]){
 const{app}=await setup(identity);assert.equal((await app.fetch(new Request(base+'/api/admin/resources',{headers:{'x-role':'admin'}}))).status,status);}
});
test('lists and details escape text and do not include private corpus body',async()=>{
 const{app}=await setup();for(const path of ['/zh/admin/resources','/zh/admin/resources?id=v1']){const r=await app.fetch(new Request(base+path));assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('<script>fixture'));assert.ok(text.includes('&lt;script&gt;'));assert.equal(r.headers.get('cache-control'),'no-store');}
});
test('batch, check and audit views are server protected',async()=>{
 const{app}=await setup();for(const view of ['batches','checks','audit'])assert.equal((await app.fetch(new Request(base+'/zh/admin/resources?view='+view))).status,200);
});
test('cross-origin, missing and forged csrf rejected',async()=>{
 const{app,request}=await setup();for(const change of [{headers:{origin:'https://evil.test'}},{form:{csrf:''}},{form:{csrf:'forged'}}])assert.equal((await app.fetch(request(undefined,change))).status,403);
});
test('csrf bound to server session and expires',async()=>{
 const{csrf,token}=await setup();assert.equal(await csrf.verify(token,{...admin,sessionId:'different'}),false);
 const c=await createAdminCsrf(new Uint8Array(32),{clock:()=>now,ttlMs:1});const t=await c.issue(admin);const later=await createAdminCsrf(new Uint8Array(32),{clock:()=>now+2,ttlMs:1});assert.equal(await later.verify(t,admin),false);
});
test('rights update, repeat and changed replay; never auto-publishes',async()=>{
 const{app,request,item,audit}=await setup();assert.equal((await app.fetch(request())).status,200);assert.equal((await app.fetch(request())).status,200);assert.equal(audit.length,1);assert.equal(item.visibility,'private');assert.equal((await app.fetch(request(undefined,{form:{decision:'deny'}}))).status,409);
});
test('training allow and payload role claims rejected',async()=>{
 const{app,request}=await setup();assert.equal((await app.fetch(request(undefined,{form:{purpose:'train',decision:'allow'}}))).status,400);assert.equal((await app.fetch(request(undefined,{form:{role:'admin'}}))).status,400);
});
test('missing target and unapproved write route rejected',async()=>{
 const{app,request}=await setup();assert.equal((await app.fetch(request('/api/admin/resources/missing/rights'))).status,404);assert.equal((await app.fetch(request('/api/admin/resources/v1/delete'))).status,404);
});
test('duplicate form fields, credential URLs and large body rejected',async()=>{
 const{app,request}=await setup();assert.equal((await app.fetch(request(undefined,{form:{evidenceUrl:'https://u:p@example.org'}}))).status,400);
 const dup=request();assert.equal((await app.fetch(new Request(dup.url,{method:'POST',headers:dup.headers,body:(await dup.text())+'&purpose=store'}))).status,400);
 assert.equal((await app.fetch(request(undefined,{form:{csrf:'x'.repeat(9000)}}))).status,413);
});
test('upstream identity/store errors fail closed without leaking details',async()=>{
 const app=createResourceAdmin({readVerifiedLegacySession:async()=>{throw Error('private detail')},store:{},csrf:{}});const r=await app.fetch(new Request(base+'/api/admin/resources'));assert.equal(r.status,503);assert.ok(!(await r.text()).includes('private detail'));
});
