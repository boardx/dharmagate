import {SOUND_BY_ID,CUE_IDS} from './sound-catalogue.mjs';
/** Playback of verified real recordings only. No generated tones or synthetic fallback. */
export const MASTER_HEADROOM=.6;
export const RECORDING_GAIN=.75;
// Digital dynamic-range protection; not a true-peak meter or an ear-level safety limit.
export const OUTPUT_COMPRESSOR=Object.freeze({threshold:-12,knee:0,ratio:20,attack:.003,release:.15});
export function createPracticeAudio({createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),getAudioSession=()=>globalThis.navigator?.audioSession,fetchRecording=(url,options)=>globalThis.fetch(url,options),soundCatalogue=SOUND_BY_ID,cueIds=CUE_IDS,schedule=setTimeout,cancel=clearTimeout,scheduleUnlock=setTimeout,cancelUnlock=clearTimeout,unlockTimeoutMs=8000,scheduleLoad=setTimeout,cancelLoad=clearTimeout,loadTimeoutMs=15000,maxRecordingBytes=4_000_000}={}){
 let context=null,master=null,limiter=null,roots=new Set(),current=[],all=new Set(),tasks=new Set(),generation=0,volume=.09,muted=false,closed=false,cues=new Set(),background=new Set(),backgroundKind=null,activeCueId=null,cueKind=null,nextCueId=0,unlockState='idle',sessionMode='unavailable',unlockPromise=null,rejectUnlock=null,stateListener=null,cueBurstVoices=0,cueBurstPending=false,audioSession=null,sessionListener=null,loadingState='idle',lastError=null;
 const cache=new Map(),pendingLoads=new Map();
 const track=node=>{all.add(node);return node};
 function cleanup(nodes){current=current.filter(n=>!nodes.includes(n));for(const n of nodes){try{n.stop?.()}catch{}try{n.disconnect()}catch{}all.delete(n);cues.delete(n);background.delete(n)}if(cues.size===0){activeCueId=null;cueKind=null}if(background.size===0)backgroundKind=null}
 function ramp(gain,value,seconds=.08){if(!context)return;const at=context.currentTime;gain.gain.cancelScheduledValues(at);gain.gain.setValueAtTime(gain.gain.value,at);gain.gain.linearRampToValueAtTime(value,at+seconds)}
 function after(fn,ms){let id=schedule(()=>{tasks.delete(id);fn()},ms);tasks.add(id)}
 function sessionState(){try{return audioSession?.state||'unavailable'}catch{return'unavailable'}}
 function abortLoads(){for(const task of pendingLoads.values())task.abort();pendingLoads.clear();loadingState='idle'}
 function interruptGraph(){if(closed)return;generation++;const voices=[...all].filter(node=>!roots.has(node));cleanup(voices);abortLoads();if(unlockState==='ready')unlockState='blocked'}
 function ready(){
  if(closed)return Promise.reject(Error('音频会话已关闭'));
  // Resume and audio-session setup execute before the first await in a real click handler.
  try{const session=getAudioSession();if(session!==audioSession){if(audioSession&&sessionListener)audioSession.removeEventListener?.('statechange',sessionListener);audioSession=session;sessionListener=null;if(session&&typeof session.addEventListener==='function'&&typeof session.removeEventListener==='function'){sessionListener=()=>{if(sessionState()==='interrupted')interruptGraph()};session.addEventListener('statechange',sessionListener)}}if(session){session.type='playback';sessionMode=session.type==='playback'?'playback':'unsupported'}else sessionMode='unavailable'}catch{sessionMode='unsupported'}
  if(!context){try{context=createContext();master=track(context.createGain());roots.add(master);master.gain.value=muted?0:volume*MASTER_HEADROOM;if(typeof context.createDynamicsCompressor==='function'){try{limiter=track(context.createDynamicsCompressor());for(const [key,value]of Object.entries(OUTPUT_COMPRESSOR))limiter[key].value=value;roots.add(limiter);master.connect(limiter);limiter.connect(context.destination)}catch{if(limiter){roots.delete(limiter);cleanup([limiter]);limiter=null}master.disconnect();master.connect(context.destination)}}else master.connect(context.destination);stateListener=()=>{if(!closed&&context.state!=='running'){const hasVoices=[...all].some(node=>!roots.has(node));if(hasVoices||pendingLoads.size||context.state==='interrupted')interruptGraph();else if(unlockState==='ready')unlockState='blocked'}};if(context.addEventListener)context.addEventListener('statechange',stateListener);else context.onstatechange=stateListener}catch{unlockState='blocked';return Promise.reject(Error('此浏览器无法创建音频，请换用 Safari 并再次点启用声音'))}}
  if(unlockPromise)return unlockPromise;
  unlockState='unlocking';let resumed;try{resumed=context.resume()}catch{unlockState='blocked';return Promise.reject(Error('浏览器拒绝音频，请再次点击启用声音'))}
  let timeout;const waiting=new Promise((resolve,reject)=>{rejectUnlock=reject;timeout=scheduleUnlock(()=>reject(Error('声音启用超时，请再次点击启用声音')),unlockTimeoutMs);Promise.resolve(resumed).then(resolve,reject)});
  unlockPromise=waiting.then(()=>{if(closed)throw Error('音频会话已关闭');if(context?.state!=='running'||sessionState()==='interrupted')throw Error('声音仍被暂停，请再次点击启用声音');unlockState='ready';return context}).catch(error=>{unlockState=closed?'closed':'blocked';throw error}).finally(()=>{cancelUnlock(timeout);unlockPromise=null;rejectUnlock=null});return unlockPromise;
 }
 function recording(id){
  const item=soundCatalogue[id],url=item?.recording?.mediaUrl;
  if(id==='silent'||!item||item.available!==true||item.recorded!==true||item.recording?.licenseVerified!==true||typeof url!=='string'||!/^\/practice\/audio\/[A-Za-z0-9][A-Za-z0-9._-]*\.mp3$/.test(url)||url.includes('..'))throw Error('此声音没有可用的已核授权录音，请重新选择');
  return item;
 }
 function decode(bytes,decoderContext){return new Promise((resolve,reject)=>{try{const result=decoderContext.decodeAudioData(bytes.slice(0),resolve,reject);if(result?.then)result.then(resolve,reject)}catch{reject(Error('DECODE_FAILED'))}})}
 function load(id){
  let item;try{item=recording(id)}catch(error){return Promise.reject(error)}
  if(cache.has(id))return Promise.resolve(cache.get(id));if(pendingLoads.has(id))return pendingLoads.get(id).promise;
  const requestGeneration=generation,decoderContext=context,controller=new AbortController();let timer,rejectOperation;
  const task={abort(){controller.abort();rejectOperation?.(Error('录音加载已取消，请重新点击试听'))},promise:null};loadingState='loading';
  const operation=(async()=>{
   let response;try{response=await fetchRecording(item.recording.mediaUrl,{method:'GET',credentials:'omit',mode:'same-origin',redirect:'error',cache:'force-cache',signal:controller.signal})}catch{throw Error('录音下载未完成，请检查网络后重试')}
   if(!response?.ok||response.redirected)throw Error('录音下载失败，请重试');
   const mime=response.headers?.get?.('content-type')||'';if(!/^audio\/(mpeg|mp3)(?:;|$)/i.test(mime))throw Error('录音响应格式不正确，未播放');
   const declared=Number(response.headers?.get?.('content-length')||0);if(!Number.isFinite(declared)||declared<0||declared>maxRecordingBytes)throw Error('录音文件超过本次加载上限');
   const bytes=await response.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>maxRecordingBytes)throw Error('录音文件为空或超过本次加载上限');
   if(closed||controller.signal.aborted||context!==decoderContext)throw Error('录音加载已取消，请重新点击试听');
   let buffer;try{buffer=await decode(bytes,decoderContext)}catch{throw Error('浏览器无法解码此录音，请重试或换用 Safari')}
   if(closed||controller.signal.aborted||context!==decoderContext)throw Error('录音加载已取消，请重新点击试听');
   if(!buffer||!Number.isFinite(buffer.duration)||buffer.duration<=0||buffer.duration>180||!Number.isInteger(buffer.numberOfChannels)||buffer.numberOfChannels<1||buffer.numberOfChannels>2||!Number.isFinite(buffer.length)||buffer.length*buffer.numberOfChannels>16_000_000)throw Error('录音解码结果不符合播放限制');
   if(cache.size>=16&&!cache.has(id)){const victim=[...cache.keys()].find(key=>!cueIds.includes(key));if(victim)cache.delete(victim);else throw Error('提示录音缓存已满，请刷新页面后选择')}
   cache.set(id,buffer);return buffer;
  })();
  const timed=new Promise((resolve,reject)=>{rejectOperation=reject;timer=scheduleLoad(()=>{controller.abort();reject(Error('录音加载超时，请检查网络后重试'))},loadTimeoutMs);operation.then(resolve,reject)});
  task.promise=timed.catch(error=>{if(!closed&&requestGeneration===generation){loadingState='error';lastError=error.message}throw error}).finally(()=>{cancelLoad(timer);if(pendingLoads.get(id)===task)pendingLoads.delete(id);if(!closed&&pendingLoads.size===0&&loadingState==='loading')loadingState='ready'});pendingLoads.set(id,task);return task.promise;
 }
 function stop(){generation++;abortLoads();const nodes=current;current=[];cues.clear();background.clear();activeCueId=null;cueKind=null;backgroundKind=null;for(const n of nodes)if(n._practiceFade)ramp(n,0);if(nodes.length)after(()=>cleanup(nodes),120)}
 function stopCues(){const nodes=[...cues];cues.clear();activeCueId=null;cueKind=null;current=current.filter(node=>!nodes.includes(node));for(const node of nodes)if(node._practiceFade)ramp(node,0);if(nodes.length)after(()=>cleanup(nodes),120)}
 function retireFallbackTails(){if(!limiter)cleanup([...all].filter(node=>!roots.has(node)&&!current.includes(node)))}
 function startRecording(id,buffer,{overlay=false}={}){
  const item=recording(id);retireFallbackTails();if(!overlay&&all.size>25)cleanup([...all].filter(node=>!roots.has(node)));
  const source=track(context.createBufferSource()),fade=track(context.createGain());source.buffer=buffer;source.loop=item.continuous===true;fade.gain.value=0;fade._practiceFade=true;source.connect(fade);fade.connect(master);ramp(fade,RECORDING_GAIN,.03);source.start();if(overlay)current.push(source,fade);else current=[source,fade];
  if(source.loop){background=new Set([source,fade]);backgroundKind=id}else{cues=new Set([source,fade]);activeCueId=++nextCueId;cueKind=id;source.onended=()=>cleanup([source,fade]);source.stop(context.currentTime+buffer.duration);after(()=>cleanup([source,fade]),(buffer.duration+.05)*1000)}return true;
 }
 function cue(id){
  if(id==='silent')return false;try{if(!cueIds.includes(id)||recording(id).continuous)throw Error('此提示没有可用的已核授权录音')}catch(error){lastError=error.message;return false}
  if(!context||closed||context.state!=='running'||sessionState()==='interrupted'||cues.size>0)return false;
  const buffer=cache.get(id);if(!buffer){lastError='提示录音尚未加载，请点击启用声音后重试';return false}
  if(cueBurstVoices>=15)return false;cueBurstVoices++;if(!cueBurstPending){cueBurstPending=true;after(()=>{cueBurstPending=false;cueBurstVoices=0},120)}retireFallbackTails();if(all.size>25)return false;return startRecording(id,buffer,{overlay:true});
 }
 return {
  async prepare(){lastError=null;const request=generation;await ready();if(closed||request!==generation)throw Error('声音启用已取消，请重新点击');const ids=cueIds.filter(id=>{try{return id!=='silent'&&recording(id).continuous===false}catch{return false}});if(!ids.length)throw Error('暂无可用的已核授权提示录音');await Promise.all(ids.map(load));if(closed)throw Error('音频会话已关闭');if(request!==generation)throw Error('声音启用已取消，请重新点击');return true},
  async play(id){let item;try{item=recording(id)}catch(error){lastError=error.message;throw error}stop();const request=++generation;lastError=null;await ready();if(closed||request!==generation)return false;const buffer=await load(id);if(closed||request!==generation||context?.state!=='running'||sessionState()==='interrupted')return false;return startRecording(id,buffer)},
  cue,bell(){return false},stop,stopCues,
  setVolume(value){if(!Number.isFinite(value)||value<0||value>1)throw Error('INVALID_VOLUME');volume=value;if(master)ramp(master,muted?0:volume*MASTER_HEADROOM)},
  setMuted(value){muted=!!value;if(master)ramp(master,muted?0:volume*MASTER_HEADROOM)},
  status(){const running=context?.state==='running'&&!closed&&sessionState()!=='interrupted';return{ready:running,playing:running&&current.length>0,backgroundPlaying:running&&background.size>0,cuePlaying:running&&cues.size>0,backgroundKind,activeCueId,cueKind,muted,volume,closed,contextState:closed?'closed':context?.state||'uninitialized',sessionMode,sessionState:sessionState(),outputProtection:limiter?'compressor':'single-graph-fallback',unlockState:closed?'closed':unlockState,loadingState,loadingCount:pendingLoads.size,lastError,cachedCueIds:cueIds.filter(id=>cache.has(id))}},
  async close(){if(closed)return;closed=true;unlockState='closed';abortLoads();loadingState='closed';cache.clear();if(audioSession&&sessionListener)audioSession.removeEventListener?.('statechange',sessionListener);audioSession=null;sessionListener=null;rejectUnlock?.(Error('音频会话已关闭'));generation++;for(const task of tasks)cancel(task);tasks.clear();cleanup([...all]);current=[];master=null;limiter=null;roots.clear();if(context){if(context.removeEventListener)context.removeEventListener('statechange',stateListener);else context.onstatechange=null;await context.close();context=null}}
 };
}
