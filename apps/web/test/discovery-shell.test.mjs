import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {renderDiscoveryPage,respondDiscovery} from '../src/discovery-shell.mjs';
import {createFullCanonLibrary} from '../src/full-canon-library.mjs';
const normalize=text=>text.replace(/nonce="[a-f0-9]+"/g,'nonce="SYNTHETIC_NONCE"').replace(/'nonce-[a-f0-9]+'/g,"'nonce-SYNTHETIC_NONCE'");
const sha=value=>createHash('sha256').update(value).digest('hex');
// Hashes captured from the original renderer before extraction, using only synthetic content.
const fixtures=[{title:'Synthetic 页面 & 版本',body:'<section id="synthetic"><h1>合成页面</h1><p>Owned fixture.</p></section>',client:'/synthetic/client.js',css:'.synthetic{color:#123456}',hash:'a8b2cbf7f8ef3c78b42ff03576f2feb99a80d45fbf0a2423c9540c65bdc81006'},{title:'',body:'',client:'/canon/zh/client.js',css:'',hash:'f01cf8d98ab0b653487ee3bbe93d300e844698f0872062b468882507d2781900'}];
const expectedHeaders={'cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'nonce-SYNTHETIC_NONCE'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'content-type':'text/html;charset=utf-8','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
test('extracted page shell preserves pre-extraction HTML bytes and response headers except nonce',async()=>{
 for(const f of fixtures){const r=renderDiscoveryPage(new Request('https://synthetic.invalid/path'),f.title,f.body,f.client,f.css);assert.equal(r.status,200);assert.equal(sha(normalize(await r.text())),f.hash);assert.deepEqual(Object.fromEntries([...r.headers].map(([k,v])=>[k,normalize(v)])),expectedHeaders)}
});
test('shell nonce remains fresh, style and CSP agree, and HEAD never returns a body',async()=>{
 const request=new Request('https://synthetic.invalid/path'),a=renderDiscoveryPage(request,'Synthetic','<p>Fixture</p>','/fixture.js'),b=renderDiscoveryPage(request,'Synthetic','<p>Fixture</p>','/fixture.js');const nonceA=(await a.text()).match(/<style nonce="([a-f0-9]+)"/)[1],nonceB=(await b.text()).match(/<style nonce="([a-f0-9]+)"/)[1];assert.notEqual(nonceA,nonceB);assert.ok(a.headers.get('content-security-policy').includes("'nonce-"+nonceA+"'"));
 const head=renderDiscoveryPage(new Request(request,{method:'HEAD'}),'Synthetic','<p>Fixture</p>','/fixture.js');assert.equal(head.body,null);assert.equal(head.status,200);
 const json=respondDiscovery(request,'synthetic','application/json;charset=utf-8',409,{'x-synthetic':'fixture'});assert.equal(json.status,409);assert.equal(json.headers.get('x-synthetic'),'fixture');assert.equal(await json.text(),'synthetic');
});
test('full canon static import closure does not pull in history data, discovery application or legacy reader',async()=>{
 const entry=new URL('../src/full-canon-library.mjs',import.meta.url),seen=new Set();
 async function walk(url){if(seen.has(url.href))return;seen.add(url.href);const source=await readFile(url,'utf8');for(const match of source.matchAll(/^import\s+(?:[^'"\n]*?from\s*)?['"]([^'"]+)['"]/gm)){if(match[1].startsWith('node:'))continue;assert.ok(match[1].startsWith('.'),'Only owned relative source imports expected');await walk(new URL(match[1],url))}}
 await walk(entry);await walk(new URL('./discovery-shell.test.mjs',import.meta.url));const paths=[...seen];assert.ok(paths.some(p=>p.endsWith('/discovery-shell.mjs')));for(const path of paths){assert.ok(!/\/(?:discovery-app|history-catalogue|chinese-library)\.mjs$/.test(path),path);assert.ok(!path.includes('/data/'),path)}
 const shell=await readFile(new URL('../src/discovery-shell.mjs',import.meta.url),'utf8');assert.ok(!/^import\s/m.test(shell));assert.ok(!/\bimport\s*\(/.test(shell));
});
test('extraction keeps canon ownership, browser assets and protected-route delegation',async()=>{
 const canon=createFullCanonLibrary({bootstrap:{commit:'a'.repeat(40)},readObject:async()=>null});
 for(const path of ['/','/login','/api/user/profile','/research','/whitepaper']){const request=new Request('https://synthetic.invalid'+path);assert.equal(await canon.fetch(request),null)}
 assert.equal((await canon.fetch(new Request('https://synthetic.invalid/canon/zh'))).status,200);assert.equal((await canon.fetch(new Request('https://synthetic.invalid/canon/zh/client.js'))).headers.get('content-type'),'text/javascript;charset=utf-8');
});
