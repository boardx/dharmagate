import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const files=['canon-sat-notice','canon-original-mirror','canon-annotation-links','canon-tree','full-canon-library','canon-experience','discovery-shell'].map(name=>'apps/web/test/'+name+'.test.mjs');
for(const [command,args] of [[process.execPath,['--test',...files]],['python3',['tools/canon/test_tei_reader.py']],['python3',['-m','unittest','discover','-s','tools/canon','-p','test_structured_reader.py']]]){
 const r=spawnSync(command,args,{cwd:root,stdio:'inherit',timeout:120000});
 if(r.error)throw r.error;
 if(r.status!==0)process.exit(r.status??1);
}
