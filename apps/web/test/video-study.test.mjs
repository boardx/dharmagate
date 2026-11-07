import test from 'node:test';
import assert from 'node:assert/strict';
import {videoStudyCatalogue as rows} from '../src/video-study-catalogue.mjs';
import {createVideoStudyLibrary,videoCategories} from '../src/video-study-library.mjs';
import {withVideoStudy} from '../src/video-study-worker.mjs';
const lib=createVideoStudyLibrary();
const request=(path,method='GET')=>new Request('https://dharmagate.us'+path,{method});
test('100 distinct complete uploads with provenance, duration and meaningful curation',()=>{
 assert.equal(rows.length,100);assert.equal(new Set(rows.map(r=>r.videoId)).size,100);
 for(const r of rows){assert.match(r.videoId,/^[\w-]{11}$/);assert.equal(r.url,'https://www.youtube.com/watch?v='+r.videoId);assert.ok(r.seconds>=480);assert.ok(r.reason.length>=20);assert.ok(r.channel&&r.teacher&&r.sourceTitle&&r.sourceType);assert.equal(r.checkedOn,'2026-11-07');assert.ok(videoCategories.includes(r.category));assert.match(r.format,/完整/);assert.doesNotMatch(r.title,/預告|预告|trailer|teaser|精彩片段/i);assert.match(r.reviewStatus,/未完整听审/);}
 assert.equal(rows.filter(r=>r.languageGroup==='zh').length,51);assert.equal(rows.filter(r=>r.languageGroup==='zh-version').length,35);assert.equal(new Set(rows.map(r=>r.category)).size,8);
 assert.equal(rows.find(r=>r.id==='tR80mtJaJRo').teacher,'梅村僧团');
 assert.ok(rows.find(r=>r.id==='XaBitGGkMBw').note.includes('转载'));
 assert.ok(!rows.some(r=>r.id==='Tc_L14QfgRs'||r.id==='dmArGum9mAY'));
});
test('the six-part original-source introductory course and starter route are complete',()=>{
 const course=rows.filter(r=>r.category==='南传系统课程');assert.equal(course.length,6);for(let i=0;i<6;i++){assert.ok(course[i].sourceTitle.includes(' - '+(i+1)+' ('));assert.equal(course[i].channel,'BAUS Chuang Yen Monastery');}
 assert.deepEqual(rows.filter(r=>r.startHere).map(r=>r.startHere).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);
});
test('page and JSON expose all 100 direct watch links, metadata and honest review status',async()=>{
 const res=lib.fetch(request('/videos')),html=await res.text();assert.equal(res.status,200);assert.equal((html.match(/class="video-card"/g)||[]).length,100);assert.equal((html.match(/class="watch"/g)||[]).length,100);assert.doesNotMatch(html,/youtube\.com\/results|<iframe|<script/);assert.match(html,/尚未全部完整听审/);assert.match(html,/中文频道版本/);assert.match(html,/name="viewport"/);assert.match(res.headers.get('content-security-policy'),/default-src 'none'/);
 const json=await lib.fetch(request('/videos/api/catalogue')).json();assert.equal(json.entryCount,100);assert.deepEqual(json.items,rows);
});
test('combined filters, source title search, empty states and invalid values',async()=>{
 const html=await lib.fetch(request('/videos?kind='+encodeURIComponent('禅修与正念')+'&lang=zh&length=short')).text();assert.match(html,/找到 3 个视频/);assert.equal((html.match(/class="watch"/g)||[]).length,3);
 const english=await lib.fetch(request('/videos?q=Four%20Ways')).text();assert.match(english,/找到 1 个视频/);assert.match(english,/USC5MJVZLy8/);
 const empty=await lib.fetch(request('/videos?q=zzzz-nothing')).text();assert.match(empty,/没有符合条件/);
 for(const p of ['/videos?kind=bad','/videos?lang=constructor','/videos?length=bad'])assert.equal(lib.fetch(request(p)).status,400);
});
test('untrusted search text is escaped and HEAD/method handling is correct',async()=>{
 const html=await lib.fetch(request('/videos?q='+encodeURIComponent('"><script>alert(1)</script>'))).text();assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 const head=lib.fetch(request('/videos','HEAD'));assert.equal(head.status,200);assert.equal(await head.text(),'');
 const post=lib.fetch(request('/videos','POST'));assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');assert.equal(lib.fetch(request('/videos/not-a-route')),null);
});
test('existing non-HTML, private and error responses are passed through with request context',async()=>{
 for(const path of ['/api/feedback','/zh/login','/canon/api/catalog']){const original=new Response('unchanged',{status:200,headers:{'content-type':'application/json','x-existing':'yes'}}),env={},ctx={};let called=0;const worker=withVideoStudy({fetch(r,e,c){called++;assert.equal(e,env);assert.equal(c,ctx);return original;}});assert.equal(await worker.fetch(request(path),env,ctx),original);assert.equal(called,1);}
 const original=new Response('unavailable',{status:503,headers:{'content-type':'text/html'}});assert.equal(await withVideoStudy({fetch:()=>original}).fetch(request('/canon')),original);
 assert.throws(()=>withVideoStudy({}),TypeError);
});
