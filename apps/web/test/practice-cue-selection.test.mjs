import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedFixture,TEST_RECORDINGS,settle} from './practice-recorded-audio-fixture.mjs';

const STRUCK='recorded-bowl-struck',OTHER='recorded-unselected-fixture';
const catalogue={...TEST_RECORDINGS,[OTHER]:{id:OTHER,available:true,recorded:true,continuous:false,recording:{licenseVerified:true,mediaUrl:'/practice/audio/unselected-fixture.mp3'}}};
const cueIds=['silent',STRUCK,OTHER];

test('selected timer cue prepares despite an unavailable unselected recording',async()=>{
 const f=recordedFixture({catalogue,cueIds,fetchStatus:url=>url.includes('unselected')?404:200});
 try{
  assert.equal(await f.engine.prepare([STRUCK]),true);
  assert.deepEqual(f.requests.map(r=>r.url),[TEST_RECORDINGS[STRUCK].recording.mediaUrl]);
  assert.equal(f.nodes.filter(n=>n.startCount).length,0,'preparation must never audition implicitly');
  assert.equal(f.engine.cue(OTHER),false);
  assert.equal(f.engine.cue(STRUCK),true);
 }finally{await f.engine.close()}
});

test('explicit selection validates and deduplicates before gesture context or network side effects',async()=>{
 for(const selected of [[],['silent'],['missing'],['recorded-bowl-rubbed'],'recorded-bowl-struck',Array(17).fill(STRUCK)]){
  const f=recordedFixture({catalogue,cueIds});
  try{await assert.rejects(f.engine.prepare(selected));assert.equal(f.calls.length,0);assert.equal(f.requests.length,0)}finally{await f.engine.close()}
 }
 const f=recordedFixture({catalogue,cueIds,deferResume:true});
 try{
  const pending=f.engine.prepare(['silent',STRUCK,STRUCK]);
  assert.deepEqual(f.calls.map(c=>c.type),['create','resume']);assert.equal(f.requests.length,0);
  f.resolveResume();assert.equal(await pending,true);assert.equal(f.requests.length,1);
 }finally{await f.engine.close()}
});

test('a failed selected recording rejects without manufacturing a fallback or changing volume',async()=>{
 const f=recordedFixture({catalogue,cueIds,fetchStatus:404});
 try{f.engine.setVolume(.12);f.engine.setMuted(true);await assert.rejects(f.engine.prepare([OTHER]),/下载失败/);assert.equal(f.requests.length,1);assert.equal(f.nodes.filter(n=>n.startCount).length,0);assert.equal(f.engine.status().volume,.12);assert.equal(f.engine.status().muted,true)}finally{await f.engine.close()}
});

test('cancelling selected preparation before resume still blocks late fetch and playback',async()=>{
 const f=recordedFixture({catalogue,cueIds,deferResume:true});
 const pending=f.engine.prepare([STRUCK]),rejected=assert.rejects(pending,/取消/);f.engine.stop();f.resolveResume();await rejected;await settle();assert.equal(f.requests.length,0);assert.equal(f.nodes.filter(n=>n.startCount).length,0);await f.engine.close();
});
