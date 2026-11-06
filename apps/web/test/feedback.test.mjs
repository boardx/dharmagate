import test from 'node:test';
import assert from 'node:assert/strict';
import {createFeedbackWorker} from '../src/feedback-worker.mjs';
import {createFeedbackGithub} from '../src/feedback-github.mjs';
const id='12345678-1234-1234-1234-123456789abc';
function setup(){
 const row={id,status:'pending'};let calls=0;
 const store={allow:async()=>true,insert:async r=>Object.assign(row,r),get:async()=>row,list:async()=>[row],claim:async()=>{if(!['pending','sync_failed'].includes(row.status))return false;row.status='syncing';return true;},reject:async()=>{if(row.status!=='pending')return false;row.status='rejected';return true;},failed:async()=>{row.status='sync_failed';},published:async(_,i)=>Object.assign(row,{status:'published',issue_url:i.html_url})};
 const github={publish:async()=>{calls++;return {number:1,html_url:'https://github.com/boardx/dharmagate/issues/1'};}};
 const worker=createFeedbackWorker({fetch:async()=>new Response('legacy')},{store,github,resolveAdmin:async r=>r.headers.get('cookie')==='verified-session'?{id:'admin'}:null});
 function req(path='',body,admin=false,origin='https://example.com'){return worker.fetch(new Request('https://example.com/api/feedback'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:origin,...(admin?{Cookie:'verified-session'}:{})},body:body===undefined?undefined:JSON.stringify(body)}));}
 return {req,row,github,calls:()=>calls};
}
test('anonymous submissions validate context and never publish',async()=>{const s=setup(),p={title:'问题',description:'说明',category:'bug',page_path:'/zh'};assert.equal((await s.req('',{...p,page_path:'/zh?token=secret'})).status,400);assert.equal((await s.req('',p)).status,201);assert.equal(s.calls(),0);assert.equal((await s.req('',p,false,'https://evil.test')).status,403);});
test('admin permission and concurrent/idempotent approvals',async()=>{const s=setup();assert.equal((await s.req()).status,403);assert.equal((await s.req('/'+id+'/approve',{})).status,403);const r=await Promise.all([s.req('/'+id+'/approve',{},true),s.req('/'+id+'/approve',{},true)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);assert.equal((await s.req('/'+id+'/approve',{},true)).status,200);assert.equal(s.calls(),1);});
test('failed sync is preserved and rejected feedback cannot publish',async()=>{const s=setup();s.github.publish=async()=>{throw Error('network');};assert.equal((await s.req('/'+id+'/approve',{},true)).status,502);assert.equal(s.row.status,'sync_failed');s.row.status='pending';assert.equal((await s.req('/'+id+'/reject',{note:'重复'},true)).status,200);assert.equal((await s.req('/'+id+'/approve',{},true)).status,409);});
test('GitHub reconciles uncertain POST outcomes without duplicates',async()=>{let posts=0;const github=createFeedbackGithub({token:'synthetic',repository:'boardx/dharmagate',fetcher:async(_,o)=>{if(o.method==='POST')posts++;return Response.json([{number:8,body:`<!-- dharmagate-feedback:${id} -->`}]);}});assert.equal((await github.publish({id})).number,8);assert.equal(posts,0);});
test('GitHub POST follows successful reconciliation',async()=>{let posted;const github=createFeedbackGithub({token:'synthetic',repository:'boardx/dharmagate',fetcher:async(_,o)=>{if(o.method==='POST'){posted=JSON.parse(o.body);return Response.json({number:9});}return Response.json([]);}});await github.publish({id,title:'测试',description:'说明',category:'bug',page_path:'/zh',created_at:'2026-11-06'});assert.match(posted.body,/dharmagate-feedback:/);assert.equal(posted.title,'[用户反馈] 测试');});
