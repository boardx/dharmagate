import {INSTRUMENT_SOUNDS} from './instrument-catalogue.mjs';
import {BACKGROUND_TRACKS} from './background-catalogue.mjs';
import {recordingAssets,recordingLicenses} from './recordings.generated.mjs';
import assets from './assets.generated.mjs';
import {practicePage} from './page.mjs';
import {renderEvidence as evidence} from './evidence.mjs';
const css=assets.css;
const INSTRUMENT_MODULE='export const INSTRUMENT_SOUNDS=Object.freeze('+JSON.stringify(INSTRUMENT_SOUNDS)+'.map(s=>Object.freeze({...s,recording:Object.freeze(s.recording)})));';

const decodedRecordings=new Map();
function recordingBytes(path,asset){
 if(!decodedRecordings.has(path)){const binary=atob(asset.base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);decodedRecordings.set(path,bytes)}
 return decodedRecordings.get(path);
}
function audioRange(value,length){
 if(!value||!/^bytes\s*=/i.test(value)||value.includes(','))return null;
 const match=value.trim().match(/^bytes=(\d*)-(\d*)$/i);if(!match||!match[1]&&!match[2])return false;
 let start,end;if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return false;start=Math.max(0,length-suffix);end=length-1}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):length-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=length||end<start)return false;end=Math.min(end,length-1)}
 return {start,end};
}
function recordingResponse(request,path,headers){
 if(path==='/practice/audio/licenses.json'){const text=JSON.stringify(recordingLicenses);return new Response(request.method==='HEAD'?null:text,{headers:{...headers,'content-type':'application/json;charset=utf-8','content-length':String(new TextEncoder().encode(text).byteLength)}})}
 if(!Object.hasOwn(recordingAssets,path))return new Response(request.method==='HEAD'?null:'Not found',{status:404,headers});
 const asset=recordingAssets[path],etag='"'+asset.sha256+'"',mediaHeaders={...headers,'content-type':'audio/mpeg','content-length':String(asset.bytes),'accept-ranges':'bytes','cache-control':'public, max-age=31536000, immutable, no-transform',etag};
 const none=request.headers.get('if-none-match');if(none&&none.split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag)){delete mediaHeaders['content-length'];return new Response(null,{status:304,headers:mediaHeaders})}
 // Range is defined for GET; HEAD retains the full representation headers without a body.
 const ifRange=request.headers.get('if-range'),range=request.method==='GET'&&(!ifRange||ifRange===etag)?audioRange(request.headers.get('range'),asset.bytes):null;
 if(range===false)return new Response(null,{status:416,headers:{...mediaHeaders,'content-range':'bytes */'+asset.bytes,'content-length':'0'}});
 if(range)return new Response(recordingBytes(path,asset).subarray(range.start,range.end+1),{status:206,headers:{...mediaHeaders,'content-range':`bytes ${range.start}-${range.end}/${asset.bytes}`,'content-length':String(range.end-range.start+1)}});
 return new Response(request.method==='HEAD'?null:recordingBytes(path,asset),{headers:mediaHeaders});
}


// Seven explicit catalogue keys only. This path never searches or reuses another bucket.
const backgroundMedia=new Map();
for(const track of BACKGROUND_TRACKS){const r=track.recording;if(!r||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isSafeInteger(r.bytes)||r.bytes<=0||r.storageKey!=='practice-background/v1/'+r.sha256+'.mp3'||r.mediaUrl!=='/practice/audio/background/'+r.sha256.slice(0,16)+'.mp3'||r.licenseVerified!==true||backgroundMedia.has(r.mediaUrl))throw Error('INVALID_FIXED_BACKGROUND_CATALOGUE');backgroundMedia.set(r.mediaUrl,r)}
if(backgroundMedia.size!==7)throw Error('UNEXPECTED_BACKGROUND_CATALOGUE_SIZE');
for(const item of INSTRUMENT_SOUNDS){const r=item.recording;if(item.recorded!==true||item.available!==true||!r||r.licenseVerified!==true||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isSafeInteger(r.bytes)||r.bytes<=0||r.storageKey!=='practice-instruments/v1/'+r.sha256+'.mp3'||r.mediaUrl!=='/practice/audio/'+r.sha256.slice(0,16)+'-instrument.mp3'||backgroundMedia.has(r.mediaUrl))throw Error('INVALID_FIXED_INSTRUMENT_CATALOGUE');backgroundMedia.set(r.mediaUrl,r)}
if(INSTRUMENT_SOUNDS.length!==3||backgroundMedia.size!==10)throw Error('UNEXPECTED_FIXED_AUDIO_SIZE');
function backgroundUnavailable(request,code,message){return new Response(request.method==='HEAD'?null:JSON.stringify({error:code,message}),{status:503,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','retry-after':'60'}})}
// Full-file SHA verification is an upload/readback gate; reads verify fixed key/size and any supplied SHA metadata.
function storedChecksum(object){const checksum=object?.checksums?.sha256;if(checksum!==undefined&&checksum!==null){let bytes;if(checksum instanceof ArrayBuffer)bytes=new Uint8Array(checksum);else if(ArrayBuffer.isView(checksum))bytes=new Uint8Array(checksum.buffer,checksum.byteOffset,checksum.byteLength);else return null;if(bytes.length!==32)return null;return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}const custom=object?.customMetadata;if(custom&&Object.hasOwn(custom,'sha256'))return typeof custom.sha256==='string'&&/^[a-f0-9]{64}$/.test(custom.sha256)?custom.sha256:null;return undefined}
function validStoredObject(object,recording){return !!object&&object.key===recording.storageKey&&object.size===recording.bytes&&(storedChecksum(object)===undefined||storedChecksum(object)===recording.sha256)&&typeof object.etag==='string'&&object.etag.length>0&&object.etag.length<=512&&!/[\x00-\x20\x7f"]/.test(object.etag)&&object.httpEtag==='"'+object.etag+'"'}
function matchesNone(value,etag){return !!value&&value.split(',').some(x=>x.trim()==='*'||x.trim().replace(/^W\//,'')===etag)}
function lastModified(object){return object.uploaded instanceof Date&&Number.isFinite(object.uploaded.getTime())?object.uploaded.toUTCString():null}
function ifRangeMatches(value,etag,modified){if(!value)return true;if(value.startsWith('"'))return value===etag;if(value.startsWith('W/'))return false;if(!modified||! /^(?:[A-Za-z]+,|[A-Za-z]{3} )/.test(value))return false;const httpDate=/^[A-Za-z]{3} [A-Za-z]{3} {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(value)?value+' GMT':value;const date=Date.parse(httpDate);return Number.isFinite(date)&&Math.floor(date/1000)===Math.floor(Date.parse(modified)/1000)}
async function closeUnusedBody(object){try{await object?.body?.cancel?.()}catch{/* Never replace the useful error with stream cleanup failure. */}}
async function backgroundResponse(request,path,env,headers){
 const recording=backgroundMedia.get(path);if(!recording)return new Response(request.method==='HEAD'?null:'Not found',{status:404,headers});
 const bucket=env?.AUDIO_STORAGE;if(!bucket||typeof bucket.head!=='function'||typeof bucket.get!=='function')return backgroundUnavailable(request,'AUDIO_STORAGE_UNAVAILABLE','录音尚未接入专用存储，请稍后再试。');
 let head;try{head=await bucket.head(recording.storageKey)}catch{return backgroundUnavailable(request,'AUDIO_STORAGE_READ_FAILED','录音暂时无法读取，请稍后重试。')}
 if(!head)return backgroundUnavailable(request,'BACKGROUND_OBJECT_UNAVAILABLE','该录音尚未准备好，请稍后再试。');
 if(!validStoredObject(head,recording))return backgroundUnavailable(request,'BACKGROUND_OBJECT_METADATA_MISMATCH','录音文件校验未通过，暂不播放。');
 const mediaHeaders={...headers,'content-type':'audio/mpeg','content-length':String(recording.bytes),'accept-ranges':'bytes','cache-control':'public, max-age=31536000, immutable, no-transform',etag:head.httpEtag},modified=lastModified(head);if(modified)mediaHeaders['last-modified']=modified;
 if(matchesNone(request.headers.get('if-none-match'),head.httpEtag)){delete mediaHeaders['content-length'];return new Response(null,{status:304,headers:mediaHeaders})}
 const range=request.method==='GET'&&ifRangeMatches(request.headers.get('if-range'),head.httpEtag,modified)?audioRange(request.headers.get('range'),recording.bytes):null;
 if(range===false)return new Response(null,{status:416,headers:{...mediaHeaders,'content-range':'bytes */'+recording.bytes,'content-length':'0'}});
 if(request.method==='HEAD')return new Response(null,{headers:mediaHeaders});
 const options={onlyIf:{etagMatches:head.etag}};if(range)options.range={offset:range.start,length:range.end-range.start+1};
 let object;try{object=await bucket.get(recording.storageKey,options)}catch{return backgroundUnavailable(request,'AUDIO_STORAGE_READ_FAILED','录音暂时无法读取，请稍后重试。')}
 // Conditional R2 get returns metadata without a body on a failed precondition. This is a race, not a client304.
 if(!object?.body||typeof object.body.getReader!=='function'){await closeUnusedBody(object);return backgroundUnavailable(request,'BACKGROUND_OBJECT_CHANGED','录音正在更新，请重新尝试。')}
 if(!validStoredObject(object,recording)||object.etag!==head.etag||(head.version&&object.version!==head.version)||(!range&&object.range&&(object.range.offset!==0||object.range.length!==recording.bytes))||(range&&(object.range?.offset!==range.start||object.range?.length!==range.end-range.start+1))){await closeUnusedBody(object);return backgroundUnavailable(request,'BACKGROUND_OBJECT_CHANGED','录音文件状态已变化，请重新尝试。')}
 if(range)return new Response(object.body,{status:206,headers:{...mediaHeaders,'content-range':`bytes ${range.start}-${range.end}/${recording.bytes}`,'content-length':String(range.end-range.start+1)}});
 return new Response(object.body,{headers:mediaHeaders});
}

export function createPracticeApplication({research={}}={}){
 return {async fetch(request,env={}){const path=new URL(request.url).pathname;if(path==='/practice/portal.css'||path==='/practice/portal.js')return null;if(path!=='/practice'&&!path.startsWith('/practice/'))return null;const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}});if(backgroundMedia.has(path)||path.startsWith('/practice/audio/background/'))return backgroundResponse(request,path,env,headers);if(path.startsWith('/practice/audio/'))return recordingResponse(request,path,headers);const files={'/practice/dashboard.js':assets.dashboard,'/practice/background-audio.js':assets.backgroundAudio,'/practice/background-catalogue.mjs':assets.backgroundCatalogue,'/practice/sound-catalogue.mjs':assets.catalogue,'/practice/instrument-catalogue.mjs':INSTRUMENT_MODULE,'/practice/client.js':assets.client,'/practice/timer-model.js':assets.timer,'/practice/audio-engine.js':assets.audio,'/practice/persistence.js':assets.persistence,'/practice/persistence.mjs':assets.persistence,'/practice/cue-schedule.js':assets.cueSchedule,'/practice/progress-model.js':assets.progress,'/practice/plan-model.js':assets.plan,'/practice/coordinator.js':assets.coordinator,'/practice/backup.mjs':assets.backup,'/practice/export-file.js':assets.exportFile,'/practice/history-plan.js':assets.historyPlan,'/practice/history-view.js':assets.historyView,'/practice/history-browser.js':assets.historyBrowser};if(Object.hasOwn(files,path))return new Response(request.method==='HEAD'?null:files[path],{headers:{...headers,'content-type':'text/javascript;charset=utf-8'}});if(!['/practice','/practice/','/practice/timer','/practice/sounds','/practice/history'].includes(path))return new Response('Not found',{status:404,headers});const nonce=crypto.randomUUID().replaceAll('-','');const html=practicePage({nonce,css,evidence:evidence(research),view:path.endsWith('/sounds')?'sounds':path.endsWith('/history')?'history':'timer'});return new Response(request.method==='HEAD'?null:html,{headers:{...headers,'content-type':'text/html;charset=utf-8','content-security-policy':`default-src 'none'; script-src 'self'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'none'; media-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`}})}};
}
