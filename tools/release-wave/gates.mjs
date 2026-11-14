import{createHash}from'node:crypto';
import{readFile,realpath}from'node:fs/promises';import{resolve,relative,sep}from'node:path';
const HASH=/^[a-f0-9]{64}$/,GIT=/^[a-f0-9]{40}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=(condition,code)=>{if(!condition)throw Error(code)};
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function publicSourcePath(path){
 if(typeof path!=='string'||path.includes('\\')||path.includes('\0')||path.startsWith('/')||path.split('/').some(x=>!x||x==='.'||x==='..'))return false;
 if(!/^(?:apps\/web\/(?:src|test)\/|tools\/|docs\/project\/|\.github\/workflows\/)/.test(path))return false;
 if(path.split('/').some(x=>['.local','.git','.aws','.codex','.agents','node_modules'].includes(x)||x.startsWith('.env')||x==='.dev.vars'))return false;
 return /\.(?:mjs|cjs|js|jsx|ts|tsx|css|json|md|txt|yml|yaml|csv)$/i.test(path)&&!path.endsWith('/recordings.generated.mjs');
}
/** Local content verification only; never uploads files or reads an inferred home/corpus. */
export async function verifyPublicManifest(manifest,{root}){
 fail(manifest&&Array.isArray(manifest.items)&&manifest.items.length>0,'PUBLIC_MANIFEST_REQUIRED');
 fail(manifest.provenanceReviewed===true&&typeof manifest.reviewReference==='string'&&manifest.reviewReference.length>0,'PROVENANCE_REVIEW_REQUIRED');
 const directory=await realpath(root),seen=new Set();
 for(const item of manifest.items){
  fail(publicSourcePath(item.path),'UNSAFE_PUBLIC_PATH');fail(!seen.has(item.path),'DUPLICATE_PUBLIC_PATH');seen.add(item.path);fail(HASH.test(item.sha256)&&Number.isSafeInteger(item.bytes)&&item.bytes>=0,'PUBLIC_PIN_REQUIRED');
  const actual=await realpath(resolve(directory,item.path)),rel=relative(directory,actual);fail(rel&&!rel.startsWith('..'+sep)&&rel!=='..'&&!rel.startsWith(sep),'PUBLIC_SYMLINK_ESCAPES_ROOT');fail(publicSourcePath(rel.split(sep).join('/')),'PUBLIC_SYMLINK_TARGET_PRIVATE');
  const bytes=await readFile(actual);fail(bytes.length===item.bytes&&sha256(bytes)===item.sha256,'PUBLIC_FILE_CHANGED');
  const text=bytes.toString('utf8');fail(Buffer.from(text,'utf8').equals(bytes)&&!text.includes('\0'),'SOURCE_NOT_UTF8_TEXT');fail(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{24,}|data:(?:audio|image|application\/pdf)[^,;]*;base64,/i.test(text),'SECRET_OR_EMBEDDED_MEDIA');
 }
 return{verified:true,files:seen.size};
}
function commandsPassed(tests,artifact){
 fail(tests?.artifactSha256===artifact&&tests.complete===true&&Array.isArray(tests.commands)&&tests.commands.length>0,'EXACT_TEST_EVIDENCE_REQUIRED');
 for(const c of tests.commands){const start=Date.parse(c.startUTC),end=Date.parse(c.endUTC);fail(c.exit===0&&Array.isArray(c.command)&&c.command.length>0&&HASH.test(c.logSHA256)&&Number.isFinite(start)&&Number.isFinite(end)&&end>=start,'FAILED_OR_UNRECORDED_COMMAND')}
}
/** Evidence consistency checks do not authenticate approval cards or prove a human test ran. */
export function assessRelease(e,{phase,expectedBaselineVersion,expectedBindingShapeSHA256,reviewedPaths}={}){
 fail(['stage','publish'].includes(phase),'EXPLICIT_RELEASE_PHASE_REQUIRED');
 fail(UUID.test(expectedBaselineVersion||'')&&HASH.test(expectedBindingShapeSHA256||'')&&Array.isArray(reviewedPaths)&&reviewedPaths.length>0,'OPERATOR_EXPECTATIONS_REQUIRED');
 const artifact=e?.candidate?.artifactSha256;fail(HASH.test(artifact||'')&&HASH.test(e?.candidate?.publicManifestSha256||''),'CANDIDATE_PINS_REQUIRED');
 fail(e.baseline?.version===expectedBaselineVersion&&e.baseline.percentage===100,'PRODUCTION_BASELINE_CHANGED');
 fail(e.baseline.bindingCount===23&&e.baseline.bindingRuntimeShapeSHA256===expectedBindingShapeSHA256,'BASELINE_BINDINGS_CHANGED');
 fail(e.configChanges===false&&e.mailScopeChanged===false&&e.accountScopeChanged===false&&e.privateCorpusIncluded===false,'SCOPE_CHANGE_REQUIRES_SEPARATE_RELEASE');
 fail(Array.isArray(e.pendingApprovals)&&e.pendingApprovals.length===0,'PENDING_APPROVAL');
 fail(e.publicManifestVerified===true,'PUBLIC_TREE_REVIEW_REQUIRED');commandsPassed(e.tests,artifact);
 fail(e.review?.passed===true&&e.review.artifactSha256===artifact&&Array.isArray(e.review.blockers)&&e.review.blockers.length===0,'INDEPENDENT_REVIEW_REQUIRED');
 for(const path of reviewedPaths)fail(HASH.test(e.candidate.sourcePins?.[path]||'')&&e.review.sourcePins?.[path]===e.candidate.sourcePins[path],'REVIEW_SOURCE_CHANGED');
 fail(e.browser?.passed===true&&e.browser.artifactSha256===artifact&&e.browser.method==='actual_browser'&&e.browser.candidateUiExercised===true&&typeof e.browser.syntheticDataUsed==='boolean','ACTUAL_BROWSER_EVIDENCE_REQUIRED');
 fail(e.git?.repository==='boardx/dharmagate'&&e.git.branch==='codex/dharmagate-consolidation-20261029'&&e.git.remoteTreeVerified===true&&GIT.test(e.git.head||'')&&GIT.test(e.git.tree||''),'REMOTE_TREE_REQUIRED');
 fail(Array.isArray(e.git.checks)&&e.git.checks.length>0&&e.git.checks.every(x=>x.head===e.git.head&&x.status==='completed'&&x.conclusion==='success'),'EXACT_CI_REQUIRED');
 if(phase==='publish'){
  fail(e.git.merged===true&&GIT.test(e.git.mergeCommit||''),'VERIFIED_MERGE_REQUIRED');
  fail(UUID.test(e.stage?.version||'')&&e.stage.artifactSha256===artifact&&e.stage.previous===expectedBaselineVersion&&e.stage.bindingCount===23&&e.stage.bindingRuntimeShapeSHA256===expectedBindingShapeSHA256&&e.stage.uploadedArtifactReadbackMatched===true,'STAGED_ARTIFACT_READBACK_REQUIRED');
 }
 return{phase,ready:true,artifactSha256:artifact,waveComplete:false,meaning:'Safe incremental release evidence is consistent; original business criteria require separate acceptance.'};
}
