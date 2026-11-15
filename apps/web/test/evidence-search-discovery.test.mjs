import test from 'node:test';import assert from 'node:assert/strict';
import {addCanonSearchEntry} from '../src/evidence-search/discovery.mjs';import {withHeartSutraTitleAlias} from '../src/evidence-search/title-alias.mjs';
test('bibliographic alias maps only exact verified title, never source text or general simplified queries',async()=>{
 const queries=[],source={text:'原文不改'},service={capabilities:{keyword:true},async search(input){queries.push(input.query);return {ok:true,query:input.query,items:[source]}}},app=withHeartSutraTitleAlias(service);
 const r=await app.search({query:'心经'});assert.equal(queries.at(-1),'心經');assert.equal(r.query,'心经');assert.equal(r.items[0],source);assert.equal(r.titleAliasMatched.sourceTextChanged,false);
 for(const query of ['心經','觀自在','观自在','心经全文']){const x=await app.search({query});assert.equal(queries.at(-1),query);assert.equal(x.titleAliasMatched,undefined);}
});
test('browse CTA guard rejects reading, RSC, errors, nonHTML, attachment and HEAD',()=>{
 let transforms=0;const old=globalThis.HTMLRewriter;globalThis.HTMLRewriter=class{on(){transforms++;return this}transform(r){return r}};
 try{for(const [url,options,response]of [
 ['/canon/zh?unit=T08n0251',{},new Response('x',{headers:{'content-type':'text/html'}})],
 ['/canon/zh',{headers:{rsc:'1'}},new Response('x',{headers:{'content-type':'text/html'}})],
 ['/canon/zh',{method:'HEAD'},new Response(null,{headers:{'content-type':'text/html'}})],
 ['/canon/zh',{},new Response('x',{status:503,headers:{'content-type':'text/html'}})],
 ['/canon/zh',{},new Response('{}',{headers:{'content-type':'application/json'}})],
 ['/canon/zh',{},new Response('x',{headers:{'content-type':'text/html','content-disposition':'attachment'}})]])assert.equal(addCanonSearchEntry(new Request('https://dharmagate.us'+url,options),response),response);
 assert.equal(transforms,0);addCanonSearchEntry(new Request('https://dharmagate.us/canon/zh'),new Response('x',{headers:{'content-type':'text/html'}}));assert.equal(transforms,1);
 }finally{if(old===undefined)delete globalThis.HTMLRewriter;else globalThis.HTMLRewriter=old}
});
