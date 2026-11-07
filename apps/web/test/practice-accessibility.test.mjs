import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/practice/page.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/practice/styles.css',import.meta.url),'utf8');
test('R8 local export recovery is initially hidden and copyable',()=>{
 assert.match(page,/<section id="export-file-ready" hidden>/);
 assert.match(page,/<a id="export-download-link" download hidden>/);
 assert.match(page,/<textarea id="export-copy-text" readonly aria-label="可复制的本机备份文字">/);
});
test('R8 status and disclaimer semantics',()=>{
 assert.match(page,/id="phase" role="status" aria-live="polite" aria-atomic="true"/);
 assert.match(page,/id="backup-file" aria-describedby="backup-file-status"/);
 assert.match(page,/<p id="practice-disclaimer">/);
 assert.match(page,/aria-valuetext="尚未开始"/);
});
test('R8 CSS reflow and accessibility safeguards are present',()=>{
 assert.match(css,/var\(--sound-stop-clearance,200px\)/);
 assert.match(css,/\.skip:focus,\.skip:focus-visible\{z-index:100\}/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(css,/\.focus-tools button,\.focus-tools a\{min-height:44px\}/);
 assert.match(css,/\.timer-panel>\*\{flex-shrink:0\}/);
});

test('real recording choices expose names authors licences and clickable provenance without retired live controls',async()=>{const{practicePage}=await import('../src/practice/page.mjs'),{SOUNDS,LEGACY_SOUND_IDS}=await import('../src/practice/sound-catalogue.mjs'),html=practicePage({nonce:'x',css:'',evidence:''});for(const sound of SOUNDS){assert.match(html,new RegExp('data-sound-choice="'+sound.id+'"'));if(sound.recording){assert.ok(html.includes(sound.name));assert.ok(html.includes(sound.recording.author));assert.ok(html.includes(sound.recording.license));assert.ok(html.includes('href="'+sound.recording.source+'" target="_blank" rel="noopener noreferrer"'))}}for(const id of LEGACY_SOUND_IDS.filter(id=>id!=='silent'))assert.ok(!html.includes('data-sound-choice="'+id+'"'));assert.match(html,/录音来源与授权/)});
