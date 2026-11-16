import {createScriptVariantSearch} from './script-variants.mjs';
import {createPhraseSearch,PHRASE_SCOPE} from './phrase-search.mjs';
import {selectSearchModes} from './select-mode.mjs';
import {createStoredCanonSearch} from './stored-canon.mjs';
import {createRetainedSearchWorker} from './retained-worker.mjs';
import {createEvidenceSearchHandler} from './http.mjs';
import {addCanonSearchEntry} from './discovery.mjs';
import {withHeartSutraTitleAlias} from './title-alias.mjs';
import {readCurrentCanonAdmission} from './catalogue-rights.mjs';
const owned=path=>['/resources/search','/_evidence-search/client.js','/_evidence-search/style.css'].includes(path)||['search','citation','answer','relations'].some(x=>path==='/api/evidence-search/'+x);
const unavailable=()=>new Response(JSON.stringify({ok:false,error:'SEARCH_SOURCE_UNAVAILABLE'}),{status:503,headers:{'content-type':'application/json','cache-control':'private, no-store'}});

export async function boundedR2Bytes(bucket,key,max){
 const object=await bucket.get(key);
 if(!object||!Number.isSafeInteger(object.size)||object.size<0||object.size>max||!object.body?.getReader){await object?.body?.cancel?.().catch(()=>{});throw Error('R2_OBJECT_SIZE_OR_BODY_INVALID');}
 const reader=object.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(!(value instanceof Uint8Array))throw Error('R2_CHUNK_INVALID');size+=value.byteLength;if(size>max||size>object.size)throw Error('R2_OBJECT_TOO_LARGE');chunks.push(value.slice());}}
 catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
 if(size!==object.size)throw Error('R2_OBJECT_SIZE_MISMATCH');
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}return bytes;
}

/** Existing CANON_STORAGE only. Cache immutable artifact bytes, never approvals,
 * sessions, promises, search output or models. Cache cannot authorize a request.
 */
export function createCanonSearchRuntime({currentWorker,edition,approvalKey,now=Date.now,artifactTTLms=30000,verifyLegacyCatalogue=readCurrentCanonAdmission}={}){
 if(typeof currentWorker?.fetch!=='function'||edition?.id!=='T08n0251'||approvalKey!=='canon/approvals/literal/T08n0251.json'||!Number.isFinite(artifactTTLms)||artifactTTLms<0||artifactTTLms>30000||typeof verifyLegacyCatalogue!=='function')throw Error('CANON_RUNTIME_CONFIGURATION_REQUIRED');
 const pin=structuredClone(edition),cache=new WeakMap();
 return Object.freeze({async fetch(request,env,ctx){
   if(!owned(new URL(request.url).pathname))return addCanonSearchEntry(request,await currentWorker.fetch(request,env,ctx));
   if(new URL(request.url).pathname==='/resources/search'&&['rsc','next-router-state-tree','next-router-prefetch','next-url'].some(h=>request.headers.has(h)))return currentWorker.fetch(request,env,ctx);
   // Apply existing origin/method/streamed-body gates before spending any R2 reads.
   let validatedInput;
   const valid=async input=>{const {request:_request,...body}=input;validatedInput=body;return {ok:true,status:200}};
   const preflight=createEvidenceSearchHandler({enabled:true,service:{capabilities:{keyword:true},search:valid,validateCitation:valid,answer:valid,relations:valid}});
   const checked=await preflight.fetch(request);if(checked&&checked.status!==200)return checked;
   if(new URL(request.url).pathname.startsWith('/_evidence-search/'))return checked;
   // Consume once through the existing 8KiB parser rather than teeing an
   // unbounded attacker-controlled body into a second unconsumed branch.
   const forwarded=validatedInput?new Request(request.url,{method:request.method,headers:request.headers,body:JSON.stringify(validatedInput)}):request;
   const bucket=env?.CANON_STORAGE;if(typeof bucket?.get!=='function')return unavailable();
   try{
    // No authorization cache: validate the actual existing legacy catalogue at
    // request entry and again before releasing any search/citation response.
    const readApprovalFresh=async()=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(await boundedR2Bytes(bucket,approvalKey,16384)));
    const freshAuthorities=async()=>{const values=await Promise.allSettled([verifyLegacyCatalogue(bucket,pin,boundedR2Bytes),readApprovalFresh()]);const rejected=values.find(value=>value.status==='rejected');if(rejected)throw rejected.reason;return values.map(value=>value.value)};
    const [legacyRevision,approvalRecord]=await freshAuthorities();
    // One immutable authorization version for this one-unit request. Per-line
    // checks still validate it, but never perform hundreds of identical R2 reads.
    // Both independent authorities are freshly reread before releasing a result.
    const approvalSnapshot=structuredClone(approvalRecord),approvalVersion=JSON.stringify(approvalSnapshot);
    const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value};freeze(approvalSnapshot);
    const readObject=async key=>{
      if(key!==pin.rawKey&&key!==pin.documentKey)throw Error('R2_KEY_NOT_ADMITTED');
      const found=cache.get(bucket)?.get(key);if(found&&found.expires>now())return found.bytes.slice();
      const bytes=await boundedR2Bytes(bucket,key,key===pin.rawKey?32000000:4000000);
      let entries=cache.get(bucket);if(!entries){entries=new Map();cache.set(bucket,entries)}
      entries.set(key,{bytes:bytes.slice(),expires:now()+artifactTTLms});return bytes;
    };
    const readApproval=async()=>approvalSnapshot;
    // A new per-request service never carries an authorizing actor/cache across requests.
    const storedSearch=await createStoredCanonSearch({edition:pin,readObject,readApproval});
    const verifiedDocument=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(await readObject(pin.documentKey)));
    const records=await Promise.all(verifiedDocument.lines.map(line=>storedSearch.repository.readCurrent({editionId:pin.id,segmentId:line.id})));
    const phraseBase=createPhraseSearch({records,readCurrent:storedSearch.repository.readCurrent,authorizeRequest:storedSearch.authorizeRequest,revision:storedSearch.repository.revision,scope:{unit:pin.id,commit:pin.sourceCommit,sourceSHA256:pin.sourceSha256,readingSHA256:pin.readingSha256}});
    const phraseService=createScriptVariantSearch({phrase:phraseBase,sourceLines:verifiedDocument.lines,scope:{unit:pin.id,commit:pin.sourceCommit,sourceSHA256:pin.sourceSha256,readingSHA256:pin.readingSha256}});
    const keyword=withHeartSutraTitleAlias(storedSearch.service);
    const service=selectSearchModes(keyword,phraseService);
    const admittedSearch={...storedSearch,service};
    const app=createRetainedSearchWorker({currentWorker,admittedSearch,scopeLabel:'CBETA《般若波羅蜜多心經》T08n0251；唐玄奘譯；CC BY-NC-SA 4.0；純公益非商業。原文未改，僅技術索引與短片段；原件含完整出版聲明與版本。'});
    const response=await app.fetch(forwarded,env,ctx);
    const [currentLegacy,currentApproval]=await freshAuthorities();
    if(currentLegacy!==legacyRevision||JSON.stringify(currentApproval)!==approvalVersion){await response?.body?.cancel();throw Error('CURRENT_ADMISSION_CHANGED');}
    return response;
   }catch{return unavailable()}
 }});
}
