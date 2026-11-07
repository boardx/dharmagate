import test from 'node:test';
import assert from 'node:assert/strict';
import {filmCatalogue} from '../src/film-catalogue.mjs';
import {createFilmLibrary} from '../src/film-library.mjs';
const library=createFilmLibrary();
test('every viewing link is a unique-title YouTube watch URL, not a search result',()=>{
 assert.equal(new Set(filmCatalogue.map(row=>row.id)).size,filmCatalogue.length);
 for(const row of filmCatalogue){assert.ok(row.links.length);for(const link of row.links){assert.match(link.videoId,/^[\w-]{11}$/);assert.equal(link.url,`https://www.youtube.com/watch?v=${link.videoId}`);assert.ok(link.channel);assert.ok(link.language);}}
});
test('catalogue contains only long uploads or full episodes and no previews',async()=>{
 for(const row of filmCatalogue){assert.ok(!row.previewOnly);for(const link of row.links){assert.ok(link.seconds>=900);assert.ok(!/预告|片头|解说/.test(link.label));}}
 const html=await library.fetch(new Request('https://dharmagate.us/films')).text();assert.ok(html.includes('GGIKkSrPZm0'));assert.ok(!html.includes('NF0JChMz8Uc'));
});
test('search supports titles and safely renders arbitrary user text; unrelated routes pass through',async()=>{
 const html=await library.fetch(new Request('https://dharmagate.us/films?q='+encodeURIComponent('虚云'))).text();assert.ok(html.includes('Hlfywey28Pw'));assert.ok(!html.includes('GGIKkSrPZm0'));
 const escaped=await library.fetch(new Request('https://dharmagate.us/films?q='+encodeURIComponent('<script>alert(1)</script>'))).text();assert.ok(!escaped.includes('<script>'));assert.ok(escaped.includes('&lt;script&gt;'));
 assert.equal(library.fetch(new Request('https://dharmagate.us/canon')),null);
 assert.equal(library.fetch(new Request('https://dharmagate.us/films',{method:'POST'})).status,405);
 assert.equal(library.fetch(new Request('https://dharmagate.us/films?kind=unknown')).status,400);
 assert.equal(await library.fetch(new Request('https://dharmagate.us/films',{method:'HEAD'})).text(),'');
});

test('expanded collection has 100 entries and 103 distinct watch links with source provenance',async()=>{
 assert.equal(filmCatalogue.length,100);
 const links=filmCatalogue.flatMap(row=>row.links);assert.equal(links.length,103);assert.equal(new Set(links.map(link=>link.videoId)).size,103);
 const additions=filmCatalogue.filter(row=>row.links.some(link=>link.checkedOn==='2026-11-07'));assert.equal(additions.length,63);
 for(const row of additions){for(const link of row.links){assert.ok(link.sourceTitle);assert.ok(['full-feature','full-documentary','full-episode'].includes(link.format));}}
 const response=library.fetch(new Request('https://dharmagate.us/films/api/catalogue'));const data=await response.json();assert.equal(data.entryCount,100);assert.equal(data.videoCount,103);
 const html=await library.fetch(new Request('https://dharmagate.us/films?kind='+encodeURIComponent('纪录片'))).text();assert.ok(html.includes('mRNmET5L2GM'));assert.ok(!html.includes('GMcZG1T5SxE'));
 const search=await library.fetch(new Request('https://dharmagate.us/films?q=Vipassana')).text();assert.ok(search.includes('WkxSyv5R1sg'));
});

test('catalogue overlay returns other routes unchanged and never invokes the base for films',async()=>{
 const {withFilmCatalogue}=await import('../src/film-catalogue-worker.mjs');
 const seen=[];let last;const base={fetch(request,env,ctx){seen.push({request,env,ctx});last=new Response('original page',{status:200,headers:{etag:'original','x-original':'retained'}});return last;}};
 const worker=withFilmCatalogue(base),env={marker:1},ctx={marker:2};
 for(const path of ['/','/explore','/canon/zh','/research/huineng','/api/feedback','/zh/login','/chatrooms']){
  const request=new Request('https://dharmagate.us'+path),result=await worker.fetch(request,env,ctx);assert.equal(result,last);assert.equal(seen.at(-1).request,request);assert.equal(seen.at(-1).env,env);assert.equal(seen.at(-1).ctx,ctx);assert.equal(result.headers.get('etag'),'original');
 }
 const count=seen.length;const response=await worker.fetch(new Request('https://dharmagate.us/films'),env,ctx);assert.equal(response.status,200);assert.equal(seen.length,count);
});
