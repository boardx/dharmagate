import test from 'node:test';
import assert from 'node:assert/strict';
import {createResourceAdmin} from '../src/resource-admin.mjs';
const origin='https://example.test',now=1900000000000;
const admin={sessionId:'explicit-fixture',user:{id:'fixture-admin',role:'admin'},expires:new Date(now+60000).toISOString()};
function setup(session=admin){
 const audit=[],seen=new Map();
 const item={id:'v1',title:'explicit artificial fixture',visibility:'private',rights:{train:'deny'}};
 const store={listVersions:async()=>[item],getVersion:async id=>id==='v1'?item:null,
 reviewRights:async row=>{const fingerprint=JSON.stringify(row);if(seen.has(row.requestId))return seen.get(row.requestId)===fingerprint?'already-reviewed':'conflict';seen.set(row.requestId,fingerprint);audit.push(row);return 'reviewed';}};
 const app=createResourceAdmin({readVerifiedLegacySession:async()=>session,store,csrfMode:'strict-json',canonicalOrigin:origin,clock:()=>now});
 const request=({headers={},body,fields={},method='POST'}={})=>new Request(origin+'/api/admin/resources/v1/rights',{method,headers:{origin,'sec-fetch-site':'same-origin','x-dharmagate-admin-request':'1','content-type':'application/json',...headers},body:method==='POST'?(body??JSON.stringify({requestId:'req1',purpose:'display',decision:'allow',evidenceUrl:'https://example.org/license',...fields})):undefined});
 return{app,request,audit,store};
}
test('strict JSON is explicit; default still requires original HMAC dependency',async()=>{
 const app=createResourceAdmin({readVerifiedLegacySession:async()=>admin,store:{}});
 assert.equal((await app.fetch(new Request(origin+'/api/admin/resources'))).status,503);
 assert.throws(()=>createResourceAdmin({csrfMode:'unexpected'}));
 assert.throws(()=>createResourceAdmin({csrfMode:'strict-json',canonicalOrigin:'http://example.test'}));
});
test('same origin JSON performs authenticated review without new persistent key',async()=>{
 const{app,request,audit}=setup();assert.equal((await app.fetch(request())).status,200);assert.equal(audit.length,1);
});
test('CSRF requirements do not replace anonymous/member/expiry authorization',async()=>{
 for(const[s,status]of [[null,401],[{...admin,user:{id:'fixture-member',role:'user'}},403],[{...admin,expires:new Date(now-1).toISOString()},401]]){
 const{app,request,audit}=setup(s);assert.equal((await app.fetch(request())).status,status);assert.equal(audit.length,0);}
});
test('every strict header missing fails closed',async()=>{
 for(const key of ['origin','sec-fetch-site','x-dharmagate-admin-request','content-type']){
 const{app,request,audit}=setup();const r=request();r.headers.delete(key);assert.equal((await app.fetch(r)).status,403);assert.equal(audit.length,0);}
});
test('malicious same-site subdomain and unrelated origin rejected',async()=>{
 for(const [site,from]of [['same-site','https://evil.example.test'],['cross-site','https://evil.test'],['same-origin','null'],['same-origin','https://example.test.evil.test']]){
 const{app,request,audit}=setup();assert.equal((await app.fetch(request({headers:{origin:from,'sec-fetch-site':site}}))).status,403);assert.equal(audit.length,0);}
});
test('simple forms, text and malformed MIME cannot change data',async()=>{
 for(const type of ['application/x-www-form-urlencoded','multipart/form-data; boundary=x','text/plain','application/jsonp']){
 const{app,request,audit}=setup();assert.equal((await app.fetch(request({headers:{'content-type':type}}))).status,403);assert.equal(audit.length,0);}
});
test('arrays, primitives, nested objects, duplicate keys and unknown keys rejected',async()=>{
 for(const body of ['[]','null','"text"','{"requestId":{"nested":"x"}}','{"requestId":"x","requestId":"y"}',JSON.stringify({role:'admin'}),JSON.stringify({csrf:'unused'})]){
 const{app,request,audit}=setup();assert.equal((await app.fetch(request({body}))).status,400);assert.equal(audit.length,0);}
});
test('oversized JSON and content-length refused',async()=>{
 const{app,request}=setup();assert.equal((await app.fetch(request({body:'x'.repeat(8193)}))).status,413);
 assert.equal((await app.fetch(request({headers:{'content-length':'8193'}}))).status,413);
});
test('strict JSON replay is idempotent; changed payload conflicts; no publication',async()=>{
 const{app,request,audit}=setup();assert.equal((await app.fetch(request())).status,200);assert.equal((await app.fetch(request())).status,200);assert.equal(audit.length,1);assert.equal((await app.fetch(request({fields:{decision:'deny'}}))).status,409);
});
test('training allow and credential evidence rejected under strict JSON',async()=>{
 const{app,request}=setup();assert.equal((await app.fetch(request({fields:{purpose:'train',decision:'allow'}}))).status,400);assert.equal((await app.fetch(request({fields:{evidenceUrl:'https://user:pass@example.org'}}))).status,400);
});
test('server-only authenticated client delivery and CSP are scoped to strict JSON',async()=>{
 const{app}=setup();const htmlResponse=await app.fetch(new Request(origin+'/zh/admin/resources?id=v1'));
 const html=await htmlResponse.text();assert.ok(html.includes('data-dg-admin-json'));assert.ok(html.includes('/api/admin/resources/client.js'));assert.ok(htmlResponse.headers.get('content-security-policy').includes("connect-src 'self'"));
 const js=await app.fetch(new Request(origin+'/api/admin/resources/client.js'));assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);
 const noAuth=setup(null);assert.equal((await noAuth.app.fetch(new Request(origin+'/api/admin/resources/client.js'))).status,401);
});
test('unexpected persistence outcome fails closed rather than reporting success',async()=>{
 const{app,request,store}=setup();store.reviewRights=async()=>undefined;assert.equal((await app.fetch(request())).status,503);
});
test('untrusted body bytes are bounded before full consumption and invalid UTF8 refused',async()=>{
 const{app,request}=setup();let pulls=0,cancelled=false;
 const stream=new ReadableStream({pull(c){pulls++;if(pulls<100)c.enqueue(new Uint8Array(8192).fill(120));else c.close();},cancel(){cancelled=true;}});
 const original=request();const large=new Request(original.url,{method:'POST',headers:original.headers,body:stream,duplex:'half'});
 assert.equal((await app.fetch(large)).status,413);assert.equal(cancelled,true);assert.ok(pulls<100);
 const bad=new Request(original.url,{method:'POST',headers:original.headers,body:new Uint8Array([0xc3,0x28])});assert.equal((await app.fetch(bad)).status,400);
});
