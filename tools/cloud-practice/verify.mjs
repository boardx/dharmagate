import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {startPreview} from './preview.mjs';
import {ownedModuleImports} from './dependencies.mjs';
const startUtc=new Date().toISOString(),preview=await startPreview({host:'127.0.0.1',port:0}),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
try{
 for(const path of ['/practice/timer','/practice/sounds','/practice/history']){
  const response=await fetch(preview.url+path),html=await response.text();check('GET '+path,response.status===200&&html.includes('type="module" src="/practice/client.js"'));check('CSP '+path,response.headers.get('content-security-policy')?.includes("connect-src 'none'")&&response.headers.get('content-security-policy')?.includes("style-src 'nonce-"));
  const head=await fetch(preview.url+path,{method:'HEAD'});check('HEAD '+path,head.status===200&&(await head.arrayBuffer()).byteLength===0);check('POST denied '+path,(await fetch(preview.url+path,{method:'POST'})).status===405);
 }
 for(const [path,file]of [['/practice/sound-catalogue.mjs','sound-catalogue.mjs'],['/practice/client.js','client.mjs'],['/practice/timer-model.js','timer.mjs'],['/practice/audio-engine.js','audio.mjs'],['/practice/persistence.js','persistence.mjs'],['/practice/persistence.mjs','persistence.mjs'],['/practice/coordinator.js','coordinator.mjs'],['/practice/backup.mjs','backup.mjs'],['/practice/export-file.js','export-file.mjs'],['/practice/history-plan.js','history-plan.mjs'],['/practice/history-view.js','history-view.mjs'],['/practice/history-browser.js','history-browser.mjs'],['/practice/cue-schedule.js','cue-schedule.mjs'],['/practice/progress-model.js','progress.mjs'],['/practice/plan-model.js','plan.mjs']]){
  const response=await fetch(preview.url+path),source=await response.text(),actual=await readFile(new URL('../../apps/web/src/practice/'+file,import.meta.url),'utf8');check('Actual source asset '+path,response.status===200&&response.headers.get('content-type')?.startsWith('text/javascript')&&source===actual);check('HEAD asset '+path,(await fetch(preview.url+path,{method:'HEAD'})).status===200);check('No writes '+path,(await fetch(preview.url+path,{method:'POST'})).status===405);
 }
 for(const path of ['/practice/portal.css','/practice/portal.js'])check('Portal owned asset '+path,(await fetch(preview.url+path)).status===200);
 for(const path of ['/zh','/admin','/api/user/profile','/canon/zh','/practice/unknown'])check('Outside preview scope '+path,(await fetch(preview.url+path)).status===404);
 const pending=['/practice/client.js'],seen=new Set();while(pending.length){const path=pending.shift();if(seen.has(path))continue;seen.add(path);const response=await fetch(preview.url+path),source=await response.text();check('Module dependency resolves '+path,response.status===200&&response.headers.get('content-type')?.startsWith('text/javascript'));for(const imported of ownedModuleImports(source)){const dependency=new URL(imported,preview.url+path);check('Dependency stays local '+imported,dependency.origin===preview.url);pending.push(dependency.pathname)}}
 check('Root is only a preview redirect',(await fetch(preview.url+'/',{redirect:'manual'})).status===307);
 const sources=['application.mjs','timer.mjs','audio.mjs','client.mjs','assets.generated.mjs'],sourceHashes={};for(const name of sources)sourceHashes[name]=createHash('sha256').update(await readFile(new URL('../../apps/web/src/practice/'+name,import.meta.url))).digest('hex');
 console.log(JSON.stringify({check:'real-loopback-practice-verification',startUtc,endUtc:new Date().toISOString(),passed:checks.length,failed:0,host:preview.host,checks,sourceHashes,productionAccepted:false,browserAccepted:false}));
}finally{await preview.close()}
