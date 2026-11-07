import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPracticeApplication} from '../src/practice/application.mjs';
import {INSTRUMENT_SOUNDS as BACKGROUND_TRACKS} from '../src/practice/instrument-catalogue.mjs';
const app=createPracticeApplication(),tracks=BACKGROUND_TRACKS;
const request=(path,init={})=>new Request('https://synthetic.invalid'+path,init);
const bytes=async response=>new Uint8Array(await response.arrayBuffer());
const fixtureBytes=(start,length)=>Uint8Array.from({length},(_,i)=>(start+i)%251);
function mockBucket({headOverrides={},getOverrides={},missing=false,metadataOnly=false,throwHead=false,throwGet=false,checksummed=false}={}){
 const calls=[],cancelled=[];
 const metadata=recording=>({key:recording.storageKey,size:recording.bytes,etag:'mock-etag-'+recording.sha256.slice(0,8),httpEtag:'"mock-etag-'+recording.sha256.slice(0,8)+'"',version:'synthetic-v1',uploaded:new Date('2026-11-08T00:00:00Z'),customMetadata:{sha256:recording.sha256},...(checksummed?{checksums:{sha256:Uint8Array.from(recording.sha256.match(/../g).map(x=>parseInt(x,16))).buffer}}:{})});
 const lookup=key=>tracks.find(x=>x.recording.storageKey===key)?.recording;
 return {calls,cancelled,
  async head(key){calls.push({method:'head',key});if(throwHead)throw Error('private upstream token should not leak');if(missing)return null;const recording=lookup(key);assert.ok(recording,'only explicit catalogue keys reach mock storage');return {...metadata(recording),...headOverrides}},
  async get(key,options){calls.push({method:'get',key,options:structuredClone(options)});if(throwGet)throw Error('private upstream token should not leak');const recording=lookup(key);assert.ok(recording);const m={...metadata(recording),...getOverrides};if(metadataOnly)return m;
   const start=options.range?.offset||0,length=options.range?.length??recording.bytes;let offset=0;
   const body=new ReadableStream({pull(controller){const n=Math.min(65536,length-offset);if(n>0){controller.enqueue(fixtureBytes(start+offset,n));offset+=n}if(offset===length)controller.close()},cancel(){cancelled.push(key)}});
   return {...m,body,...(options.range?{range:{offset:start,length}}:{}),...getOverrides};
  }
 };
}
const get=(track,bucket,init={})=>app.fetch(request(track.recording.mediaUrl,init),{AUDIO_STORAGE:bucket});

test('all three instrument fixed paths use only their fixed AUDIO_STORAGE keys and stream a correct first-byte probe',async()=>{
 assert.equal(tracks.length,3);const bucket=mockBucket();
 for(const track of tracks){const response=await get(track,bucket,{headers:{range:'bytes=0-1'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.equal(response.headers.get('content-range'),'bytes 0-1/'+track.recording.bytes);assert.equal(response.headers.get('content-length'),'2');assert.match(response.headers.get('cache-control'),/immutable.*no-transform/);assert.deepEqual(await bytes(response),fixtureBytes(0,2));
  const call=bucket.calls.at(-1);assert.equal(call.method,'get');assert.equal(call.key,track.recording.storageKey);assert.deepEqual(call.options.range,{offset:0,length:2});assert.deepEqual(call.options.onlyIf,{etagMatches:'mock-etag-'+track.recording.sha256.slice(0,8)});assert.notEqual(response.headers.get('etag'),'"'+track.recording.sha256+'"','R2 ETag is not the declared source SHA256');
 }
 const query=await app.fetch(request(tracks[0].recording.mediaUrl+'?key=elsewhere&bucket=CANON_STORAGE',{headers:{range:'bytes=0-1'}}),{AUDIO_STORAGE:bucket});assert.equal(query.status,206);await bytes(query);assert.equal(bucket.calls.at(-1).key,tracks[0].recording.storageKey);assert.ok(bucket.calls.every(call=>tracks.some(t=>t.recording.storageKey===call.key)));
});
test('full GET streams mock data and HEAD reads metadata only with full representation headers',async()=>{
 const track=tracks[0],bucket=mockBucket(),full=await get(track,bucket);assert.equal(full.status,200);assert.equal(full.headers.get('content-length'),String(track.recording.bytes));assert.deepEqual(await bytes(full),fixtureBytes(0,track.recording.bytes));assert.equal(bucket.calls.at(-1).options.range,undefined);
 const headBucket=mockBucket(),head=await get(track,headBucket,{method:'HEAD',headers:{range:'bytes=0-1'}});assert.equal(head.status,200);assert.equal((await bytes(head)).length,0);assert.equal(head.headers.get('content-length'),String(track.recording.bytes));assert.deepEqual(headBucket.calls.map(x=>x.method),['head']);
});
test('open, bounded and suffix ranges are mapped to explicit offset/length and have exact Content-Range',async()=>{
 const track=tracks[1],length=track.recording.bytes;
 for(const [range,start,end]of [['bytes=101-109',101,109],['bytes='+(length-3)+'-',length-3,length-1],['bytes=-4',length-4,length-1],['bytes='+(length-3)+'-'+(length+200),length-3,length-1]]){const bucket=mockBucket(),response=await get(track,bucket,{headers:{range}});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${length}`);assert.deepEqual(await bytes(response),fixtureBytes(start,end-start+1));assert.deepEqual(bucket.calls.at(-1).options.range,{offset:start,length:end-start+1})}
});
test('invalid and unsatisfiable ranges return416 without reading an object body',async()=>{
 const track=tracks[2];for(const range of ['bytes='+track.recording.bytes+'-','bytes=2-1','bytes=-0','bytes=-','bytes=x-y','bytes=9007199254740993-']){const bucket=mockBucket(),response=await get(track,bucket,{headers:{range}});assert.equal(response.status,416);assert.equal(response.headers.get('content-range'),'bytes */'+track.recording.bytes);assert.equal((await bytes(response)).length,0);assert.deepEqual(bucket.calls.map(x=>x.method),['head'])}
});
test('If-Range uses HTTP validators locally; mismatches return full200 and do not get forwarded as R2 headers',async()=>{
 const track=tracks[0],etag='"mock-etag-'+track.recording.sha256.slice(0,8)+'"';
 for(const value of [etag,'Sun, 08 Nov 2026 00:00:00 GMT','Sunday, 08-Nov-26 00:00:00 GMT','Sun Nov  8 00:00:00 2026']){const bucket=mockBucket(),response=await get(track,bucket,{headers:{range:'bytes=0-1','if-range':value}});assert.equal(response.status,206);assert.equal((await bytes(response)).length,2);assert.equal(bucket.calls.at(-1).options instanceof Headers,false)}
 for(const value of ['"old-etag"','W/'+etag,'Sat, 07 Nov 2026 00:00:00 GMT','nonsense']){const bucket=mockBucket(),response=await get(track,bucket,{headers:{range:'bytes=0-1','if-range':value}});assert.equal(response.status,200);assert.equal((await bytes(response)).length,track.recording.bytes);assert.equal(bucket.calls.at(-1).options.range,undefined)}
});
test('If-None-Match304 checks the live declared object metadata without reading the body',async()=>{
 const track=tracks[0],etag='"mock-etag-'+track.recording.sha256.slice(0,8)+'"';for(const value of [etag,'W/'+etag,'*']){const bucket=mockBucket(),response=await get(track,bucket,{headers:{'if-none-match':value}});assert.equal(response.status,304);assert.equal((await bytes(response)).length,0);assert.deepEqual(bucket.calls.map(x=>x.method),['head'])}
});
test('missing binding or object is explicit503 and cannot fall back to canon storage or legacy content',async()=>{
 const track=tracks[0];let canonAccess=0;const env={get CANON_STORAGE(){canonAccess++;throw Error('forbidden canon access')}};
 const response=await app.fetch(request(track.recording.mediaUrl),env);assert.equal(response.status,503);assert.equal((await response.json()).error,'AUDIO_STORAGE_UNAVAILABLE');assert.equal(canonAccess,0);
 const missing=await get(track,mockBucket({missing:true}));assert.equal(missing.status,503);assert.equal((await missing.json()).error,'BACKGROUND_OBJECT_UNAVAILABLE');assert.equal(missing.headers.get('cache-control'),'no-store');assert.equal(missing.headers.get('retry-after'),'60');
 const head=await app.fetch(request(track.recording.mediaUrl,{method:'HEAD'}),{});assert.equal(head.status,503);assert.equal((await bytes(head)).length,0);
});
test('metadata integrity and conditional-read races fail closed; an R2 no-body result is503 rather than false304',async()=>{
 const track=tracks[0];for(const headOverrides of [{size:track.recording.bytes+1},{key:'arbitrary/private-key'},{customMetadata:{sha256:'0'.repeat(64)}},{etag:'bad\r\nvalue'},{httpEtag:'unquoted'}]){const bucket=mockBucket({headOverrides}),response=await get(track,bucket);assert.equal(response.status,503);assert.equal((await response.json()).error,'BACKGROUND_OBJECT_METADATA_MISMATCH');assert.deepEqual(bucket.calls.map(x=>x.method),['head'])}
 const metadataOnly=await get(track,mockBucket({metadataOnly:true}));assert.equal(metadataOnly.status,503);assert.equal((await metadataOnly.json()).error,'BACKGROUND_OBJECT_CHANGED');
 for(const getOverrides of [{version:'new-version'},{etag:'different',httpEtag:'"different"'},{range:{offset:3,length:2}},{customMetadata:{sha256:'f'.repeat(64)}}]){const bucket=mockBucket({getOverrides}),response=await get(track,bucket,{headers:{range:'bytes=0-1'}});assert.equal(response.status,503);assert.equal((await response.json()).error,'BACKGROUND_OBJECT_CHANGED');assert.equal(bucket.cancelled.length,1)}
});
test('fixed full-hash key and size are mandatory; optional R2 SHA metadata is checked distinctly from ETag',async()=>{
 const track=tracks[0];const noSha=await get(track,mockBucket({headOverrides:{customMetadata:{}},getOverrides:{customMetadata:{}}}),{headers:{range:'bytes=0-1'}});assert.equal(noSha.status,206);assert.equal((await bytes(noSha)).length,2);const valid=await get(track,mockBucket({checksummed:true}),{headers:{range:'bytes=0-1'}});assert.equal(valid.status,206);assert.equal((await bytes(valid)).length,2);
 const bad=await get(track,mockBucket({headOverrides:{checksums:{sha256:new Uint8Array(32).buffer}}}));assert.equal(bad.status,503);
});
test('storage exceptions expose no upstream details, and methods/unknown paths do not access storage',async()=>{
 const track=tracks[0];for(const options of [{throwHead:true},{throwGet:true}]){const response=await get(track,mockBucket(options));assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private upstream'))}
 const bucket=mockBucket();for(const path of ['/practice/audio/background/unknown.mp3','/practice/audio/background/'+track.recording.sha256+'.mp3','/practice/audio/background/%2e%2e.mp3'])assert.equal((await app.fetch(request(path),{AUDIO_STORAGE:bucket})).status,404);
 for(const method of ['POST','PUT','DELETE'])assert.equal((await get(track,bucket,{method})).status,405);assert.equal(bucket.calls.length,0);
 for(const path of ['/admin','/canon/zh','/practice/portal.js','/practice/portal.css'])assert.equal(await app.fetch(request(path),{AUDIO_STORAGE:bucket}),null);
});
test('old embedded recordings and same-origin background modules remain available independently of R2',async()=>{
 const old=await app.fetch(request('/practice/audio/55f8b4c1884a-bowl-struck.mp3',{headers:{range:'bytes=0-1'}}),{});assert.equal(old.status,206);assert.deepEqual(await bytes(old),Uint8Array.from([73,68]));
 for(const [url,file]of [['/practice/background-audio.js','background-audio.mjs'],['/practice/background-catalogue.mjs','background-catalogue.mjs']]){const response=await app.fetch(request(url),{});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'text/javascript;charset=utf-8');assert.equal(await response.text(),await readFile(new URL('../src/practice/'+file,import.meta.url),'utf8'))}
 const csp=(await app.fetch(request('/practice/sounds'),{})).headers.get('content-security-policy');assert.ok(csp.includes("connect-src 'self'")&&csp.includes("media-src 'self'")&&!csp.includes('https:'));
});
