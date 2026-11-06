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
 for(const row of filmCatalogue){assert.ok(!row.previewOnly);for(const link of row.links){assert.ok(link.seconds>=1200);assert.ok(!/预告|片头|解说/.test(link.label));}}
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
