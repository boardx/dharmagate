import {recordingAssets,recordingLicenses} from './recordings.generated.mjs';
import assets from './assets.generated.mjs';
import {practicePage} from './page.mjs';
import {renderEvidence as evidence} from './evidence.mjs';
const css=assets.css;

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

export function createPracticeApplication({research={}}={}){
 return {async fetch(request){const path=new URL(request.url).pathname;if(path==='/practice/portal.css'||path==='/practice/portal.js')return null;if(path!=='/practice'&&!path.startsWith('/practice/'))return null;const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}});if(path.startsWith('/practice/audio/'))return recordingResponse(request,path,headers);const files={'/practice/sound-catalogue.mjs':assets.catalogue,'/practice/client.js':assets.client,'/practice/timer-model.js':assets.timer,'/practice/audio-engine.js':assets.audio,'/practice/persistence.js':assets.persistence,'/practice/persistence.mjs':assets.persistence,'/practice/cue-schedule.js':assets.cueSchedule,'/practice/progress-model.js':assets.progress,'/practice/plan-model.js':assets.plan,'/practice/coordinator.js':assets.coordinator,'/practice/backup.mjs':assets.backup,'/practice/export-file.js':assets.exportFile,'/practice/history-plan.js':assets.historyPlan,'/practice/history-view.js':assets.historyView,'/practice/history-browser.js':assets.historyBrowser};if(Object.hasOwn(files,path))return new Response(request.method==='HEAD'?null:files[path],{headers:{...headers,'content-type':'text/javascript;charset=utf-8'}});if(!['/practice','/practice/','/practice/timer','/practice/sounds','/practice/history'].includes(path))return new Response('Not found',{status:404,headers});const nonce=crypto.randomUUID().replaceAll('-','');const html=practicePage({nonce,css,evidence:evidence(research),view:path.endsWith('/sounds')?'sounds':path.endsWith('/history')?'history':'timer'});return new Response(request.method==='HEAD'?null:html,{headers:{...headers,'content-type':'text/html;charset=utf-8','content-security-policy':`default-src 'none'; script-src 'self'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'none'; media-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`}})}};
}
