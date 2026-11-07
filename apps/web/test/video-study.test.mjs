import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {videoStudyCatalogue as rows} from '../src/video-study-catalogue.mjs';
import {createVideoStudyLibrary,videoCategories} from '../src/video-study-library.mjs';
import {withVideoStudyCatalogue} from '../src/video-study-worker.mjs';
const lib=createVideoStudyLibrary();
const request=(path,method='GET')=>new Request('https://dharmagate.us'+path,{method});
const html=path=>lib.fetch(request(path)).text();
const count=s=>(s.match(/class="video-card"/g)||[]).length;

test('100 unique direct uploads retain provenance and measured late-frame evidence',()=>{
 assert.equal(rows.length,100);assert.equal(new Set(rows.map(r=>r.videoId)).size,100);
 for(const r of rows){assert.match(r.videoId,/^[\w-]{11}$/);assert.equal(r.url,'https://www.youtube.com/watch?v='+r.videoId);assert.ok(r.seconds>=480);assert.ok(r.reason.length>=20);assert.ok(r.sourceTitle&&r.teacher&&r.channel&&r.qualityNote&&r.prerequisite);assert.ok(videoCategories.includes(r.category));assert.equal(r.audit.readyState,4);assert.ok(r.audit.lateSampleSeconds>r.seconds*.85);assert.ok(r.audit.lateSampleSeconds<r.seconds);assert.match(r.reviewStatus,/未完整听审/);assert.doesNotMatch(r.title,/预告|預告|trailer|teaser/i);}
 assert.equal(new Set(rows.map(r=>r.category)).size,8);
});
test('four replacements have traceable reasons and exclude the re-edited and region-blocked versions',async()=>{
 const report=JSON.parse(await readFile(new URL('../../../docs/project/releases/videos-review-20261107-sources.json',import.meta.url),'utf8'));
 assert.equal(report.replacements.length,4);assert.equal(report.observations.length,104);
 for(const r of report.replacements){assert.ok(!rows.some(x=>x.id===r.oldId));assert.ok(rows.some(x=>x.id===r.newId));assert.ok(r.reason.length>30);}
 assert.ok(report.observations.find(r=>r.videoId==='mRNmET5L2GM').regionRestricted);
 assert.match(report.replacements.find(r=>r.oldId==='XaBitGGkMBw').reason,/拼接/);
});
test('Chinese uploads, burned-in text, machine translation and unknown states remain distinct',()=>{
 assert.equal(rows.filter(r=>r.captions.kind==='uploaded').length,10);assert.equal(rows.filter(r=>r.captions.kind==='burned').length,34);assert.equal(rows.filter(r=>r.captions.chineseConfirmed).length,44);
 const breathing=rows.find(r=>r.id==='tt8UVWOeTh8');assert.equal(breathing.captions.kind,'burned');assert.deepEqual(breathing.captions.chineseTracks,[]);assert.ok(breathing.audit.captionMenu.some(t=>t.includes('>> Chinese')));
 const bodhi=rows.find(r=>r.id==='9qP7zWzDtuY');assert.equal(bodhi.captions.chineseConfirmed,false);assert.equal(bodhi.captions.chineseTracks.length,0);
 assert.equal(rows.find(r=>r.id==='bB3Hk17VLkM').captions.kind,'none-declared');assert.equal(rows.find(r=>r.id==='hUKPkTFTHZk').captions.kind,'burned');
 for(const r of rows)assert.ok(r.captions.chineseTracks.every(t=>!/(auto|>>)/i.test(t)));
});
test('all100have a unique order, with confirmed Chinese access first and six course sessions ordered',()=>{
 const route=[...rows].sort((a,b)=>a.watchOrder-b.watchOrder);assert.deepEqual(route.map(r=>r.watchOrder),Array.from({length:100},(_,i)=>i+1));assert.ok(route.slice(0,68).every(r=>r.chineseAccessible));assert.ok(route.slice(68).every(r=>!r.chineseAccessible));
 const starter=rows.filter(r=>r.startHere);assert.equal(starter.length,8);assert.ok(starter.every(r=>r.chineseAccessible));assert.ok(!starter.some(r=>r.id==='9qP7zWzDtuY'));
 const course=route.filter(r=>r.category==='南传系统课程');assert.equal(course.length,6);course.forEach((r,i)=>assert.ok(r.sourceTitle.includes(' - '+(i+1)+' (')));
 for(const r of rows)for(const b of r.bookmarks){assert.ok(b.seconds>=0&&b.seconds<r.seconds);assert.ok(b.basis);}
});
test('page and API expose the revised counts, sources, limits and100direct playback buttons',async()=>{
 const response=lib.fetch(request('/videos')),s=await response.text();assert.equal(response.status,200);assert.equal(count(s),100);assert.equal((s.match(/class="watch"/g)||[]).length,100);assert.match(s,/展开完整观看顺序（100条）/);assert.match(s,/替换4条/);assert.match(s,/未完整听审/);assert.doesNotMatch(s,/youtube\.com\/results|<iframe|<script/);
 const data=await lib.fetch(request('/videos/api/catalogue')).json();assert.equal(data.entryCount,100);assert.equal(data.chineseAccessibleCount,68);assert.equal(data.chineseCaptionCount,44);assert.equal(data.replacedCount,4);assert.deepEqual(data.items,rows);
});
test('caption and language filters compose correctly and reject prototype names and invalid ordering',async()=>{
 assert.equal(count(await html('/videos?captions=confirmed')),44);assert.equal(count(await html('/videos?captions=uploaded')),10);assert.equal(count(await html('/videos?captions=burned')),34);assert.equal(count(await html('/videos?lang=chinese')),68);assert.equal(count(await html('/videos?captions=none-declared')),1);assert.equal(count(await html('/videos?captions=unconfirmed')),55);
 assert.equal(count(await html('/videos?lang=other&captions=confirmed')),0);assert.equal(count(await html('/videos?lang=chinese&captions=confirmed')),44);
 const s=await html('/videos?q=Four%20Ways&captions=uploaded');assert.equal(count(s),1);assert.match(s,/USC5MJVZLy8/);
 for(const p of ['/videos?kind=bad','/videos?lang=constructor','/videos?captions=__proto__','/videos?order=constructor'])assert.equal(lib.fetch(request(p)).status,400);
});
test('search and catalogue text are escaped and HTTP method behavior is preserved',async()=>{
 const s=await html('/videos?q='+encodeURIComponent('"><script>alert(1)</script>'));assert.doesNotMatch(s,/<script>/);assert.match(s,/&lt;script&gt;/);
 const custom=createVideoStudyLibrary({catalogue:[{...rows[0],title:'<img src=x onerror=evil()>'}]});assert.match(await custom.fetch(request('/videos')).text(),/&lt;img/);
 for(const p of ['/videos','/videos/','/videos/api/catalogue']){const h=lib.fetch(request(p,'HEAD'));assert.equal(h.status,200);assert.equal(await h.text(),'');}
 const post=lib.fetch(request('/videos','POST'));assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');assert.equal(lib.fetch(request('/videos/not-a-route')),null);
});
test('catalogue-only overlay preserves existing HTML including navigation, APIs, headers and context',async()=>{
 for(const path of ['/','/explore','/films','/canon/zh','/api/feedback','/zh/login']){const original=new Response('<nav><a href="/videos">video</a></nav>',{headers:{'content-type':'text/html','x-existing':'yes'}}),env={},ctx={};let calls=0;const worker=withVideoStudyCatalogue({fetch(r,e,c){calls++;assert.equal(e,env);assert.equal(c,ctx);return original;}});assert.equal(await worker.fetch(request(path),env,ctx),original);assert.equal(calls,1);}
 let calls=0;const worker=withVideoStudyCatalogue({fetch(){calls++;throw Error('unexpected');}});assert.equal((await worker.fetch(request('/videos'))).status,200);assert.equal(calls,0);assert.throws(()=>withVideoStudyCatalogue({}),TypeError);
});
