import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createPracticeApplication} from '../src/practice/application.mjs';
import {recordingAssets,recordingLicenses} from '../src/practice/recordings.generated.mjs';
const publicRoot=new URL('../public/practice-audio/',import.meta.url),app=createPracticeApplication();
const get=(path,init={})=>app.fetch(new Request('https://synthetic.invalid'+path,init));
const sha=x=>createHash('sha256').update(x).digest('hex');
const body=async response=>new Uint8Array(await response.arrayBuffer());
for(const item of recordingLicenses.recordings){
 test('reviewed recording exact GET/HEAD bytes and immutable metadata '+item.id,async()=>{
  const file=await readFile(new URL(item.file,publicRoot)),response=await get(item.mediaUrl),bytes=await body(response);
  assert.equal(response.status,200);assert.deepEqual(bytes,new Uint8Array(file));assert.equal(sha(bytes),item.sha256);assert.equal(bytes.length,item.bytes);
  assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.equal(response.headers.get('content-length'),String(item.bytes));assert.equal(response.headers.get('accept-ranges'),'bytes');assert.match(response.headers.get('cache-control'),/public.*max-age=31536000.*immutable/);assert.equal(response.headers.get('etag'),'"'+item.sha256+'"');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const head=await get(item.mediaUrl,{method:'HEAD',headers:{range:'bytes=0-1'}});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(file.length));assert.equal((await body(head)).length,0);
 });
 test('recording single, open-ended and suffix ranges are exact '+item.id,async()=>{
  const file=await readFile(new URL(item.file,publicRoot));
  for(const [range,start,end]of [['bytes=0-1',0,1],['bytes=100-199',100,199],['bytes='+(file.length-4)+'-',file.length-4,file.length-1],['bytes=-5',file.length-5,file.length-1],['bytes=0-'+(file.length+100),0,file.length-1],['bytes=-'+(file.length+100),0,file.length-1]]){
   const response=await get(item.mediaUrl,{headers:{range}});assert.equal(response.status,206,range);assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${file.length}`);assert.equal(response.headers.get('content-length'),String(end-start+1));assert.deepEqual(await body(response),new Uint8Array(file.subarray(start,end+1)),range);
  }
 });
 test('recording unsatisfiable/malformed ranges return416 without data '+item.id,async()=>{
  for(const range of ['bytes='+item.bytes+'-','bytes=4-3','bytes=-0','bytes=-','bytes=nope','bytes=9007199254740993-']){const response=await get(item.mediaUrl,{headers:{range}});assert.equal(response.status,416,range);assert.equal(response.headers.get('content-range'),'bytes */'+item.bytes);assert.equal(response.headers.get('content-length'),'0');assert.equal((await body(response)).length,0)}
  for(const range of ['items=0-1','bytes=0-1,4-5']){const response=await get(item.mediaUrl,{headers:{range}});assert.equal(response.status,200);assert.equal((await body(response)).length,item.bytes)}
 });
 test('recording validators preserve exact representations '+item.id,async()=>{
  const etag='"'+item.sha256+'"';for(const none of [etag,'W/'+etag,'*']){const response=await get(item.mediaUrl,{headers:{'if-none-match':none}});assert.equal(response.status,304);assert.equal((await body(response)).length,0)}
  const partial=await get(item.mediaUrl,{headers:{range:'bytes=0-1','if-range':etag}});assert.equal(partial.status,206);assert.equal((await body(partial)).length,2);
  const full=await get(item.mediaUrl,{headers:{range:'bytes=0-1','if-range':'"old"'}});assert.equal(full.status,200);assert.equal((await body(full)).length,item.bytes);
 });
}
test('public license endpoint exposes only recording metadata and no private receipts',async()=>{
 const response=await get('/practice/audio/licenses.json'),data=await response.json();assert.equal(response.status,200);assert.deepEqual(data,recordingLicenses);assert.equal(data.recordings.length,3);
 assert.equal(JSON.stringify(data).includes('.local'),false);assert.equal(JSON.stringify(data).includes('startedUTC'),false);assert.equal(JSON.stringify(data).includes('downloadedUTC'),false);assert.ok(data.recordings.every(x=>x.licenseVerified&&x.auditionVerified===false));
 assert.equal((await body(await get('/practice/audio/licenses.json',{method:'HEAD'}))).length,0);
});
test('media routes are exact whitelists and retain method/delegation boundaries',async()=>{
 assert.equal(Object.keys(recordingAssets).length,3);
 for(const path of ['/practice/audio/unknown.mp3','/practice/audio/55f8b4c1884a740b6.mp3','/practice/audio/licenses.private.json','/practice/audio/%2fetc%2fpasswd'])assert.equal((await get(path)).status,404);
 for(const method of ['POST','PUT','DELETE']){const response=await get(recordingLicenses.recordings[0].mediaUrl,{method});assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET, HEAD')}
 for(const path of ['/practice/portal.js','/practice/portal.css','/canon/zh','/admin','/api/user/profile'])assert.equal(await get(path),null);
});
test('practice CSP permits only same-origin media and connection, with previous constraints retained',async()=>{
 const response=await get('/practice/sounds'),csp=response.headers.get('content-security-policy');
 for(const rule of ["default-src 'none'","script-src 'self'","connect-src 'self'","media-src 'self'","img-src 'none'","base-uri 'none'","frame-ancestors 'none'","form-action 'none'"])assert.ok(csp.includes(rule),rule);
 assert.match(csp,/style-src 'nonce-[a-f0-9]{32}'/);assert.ok(!csp.includes('https:')&&!csp.includes('*')&&!csp.includes('unsafe-inline'));
});
test('deterministic recording generator checks the reviewed manifest and actual files without private discovery',()=>{
 const result=spawnSync(process.execPath,['apps/web/src/practice/build-recordings.mjs','--check'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const summary=JSON.parse(result.stdout);assert.equal(summary.recordings,3);assert.equal(summary.bytes,401837);assert.equal(summary.humanAuditionVerified,false);
});

test('real loopback HTTP serves exact Safari probe/seek bytes and terminates cleanly',async()=>{
 const {startPreview}=await import('../../../tools/cloud-practice/preview.mjs'),preview=await startPreview({host:'127.0.0.1',port:0});
 try{
  for(const item of recordingLicenses.recordings){const file=await readFile(new URL(item.file,publicRoot));
   for(const [range,start,end]of [['bytes=0-1',0,1],['bytes=-5',file.length-5,file.length-1]]){const response=await fetch(preview.url+item.mediaUrl,{headers:{range}});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${file.length}`);assert.deepEqual(await body(response),new Uint8Array(file.subarray(start,end+1)))}
   const head=await fetch(preview.url+item.mediaUrl,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(file.length));assert.equal((await body(head)).length,0);
   const invalid=await fetch(preview.url+item.mediaUrl,{headers:{range:'bytes='+file.length+'-'}});assert.equal(invalid.status,416);assert.equal((await body(invalid)).length,0);
  }
 }finally{await preview.close()}
});
