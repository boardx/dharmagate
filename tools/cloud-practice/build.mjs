import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assets from '../../apps/web/src/practice/assets.generated.mjs';
import {createPracticeApplication} from '../../apps/web/src/practice/application.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
const files={dashboard:'dashboard.mjs',backgroundAudio:'background-audio.mjs',backgroundCatalogue:'background-catalogue.mjs',catalogue:'sound-catalogue.mjs',client:'client.mjs',timer:'timer.mjs',audio:'audio.mjs',persistence:'persistence.mjs',coordinator:'coordinator.mjs',backup:'backup.mjs',exportFile:'export-file.mjs',historyPlan:'history-plan.mjs',historyView:'history-view.mjs',historyBrowser:'history-browser.mjs',cueSchedule:'cue-schedule.mjs',progress:'progress.mjs',plan:'plan.mjs',css:'styles.css'},hashes={};
for(const [name,file] of Object.entries(files)){
 const text=await readFile(new URL('../../apps/web/src/practice/'+file,import.meta.url),'utf8');
 assert.equal(assets[name],text,'Generated asset differs from actual source: '+file);
 hashes[file]=sha(text);
}
const research=JSON.parse(await readFile(new URL('../../apps/web/data/practice-research.json',import.meta.url),'utf8'));
assert.equal(typeof research.summary,'string');assert.ok(Array.isArray(research.items));
const app=createPracticeApplication({research}),response=await app.fetch(new Request('https://portable.invalid/practice/timer'));
assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/connect-src 'self'/);
console.log(JSON.stringify({check:'portable-practice-build',passed:true,node:process.version,generatedAssetsMatch:true,researchItems:research.items.length,sourceHashes:hashes,wroteSource:false}));
