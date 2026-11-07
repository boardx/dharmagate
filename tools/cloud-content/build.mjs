// Validate the owned source closure without production bindings or corpus.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url);
const files=['discovery-shell.mjs','full-canon-library.mjs','canon-original-mirror.mjs','canon-annotation-browser.mjs','canon-tree.mjs','canon-annotation-links.mjs','tei-browser-reader.mjs','canon-theme-fix.mjs','canon-experience/worker.mjs','canon-experience/client.js'];
const inputs=[];
for(const name of files){
 const file=new URL('apps/web/src/'+name,root),bytes=await readFile(file);
 const r=spawnSync(process.execPath,['--check',fileURLToPath(file)],{stdio:'inherit'});
 if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);
 inputs.push({path:'apps/web/src/'+name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
// Import the actual server factories: any missing or protected static dependency fails here.
await import('../../apps/web/src/full-canon-library.mjs');
console.log(JSON.stringify({kind:'portable-content-source-check',node:process.version,inputs,productionBundle:false,deploymentReady:false,privateCorpusUsed:false}));
