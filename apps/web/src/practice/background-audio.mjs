import {BACKGROUND_BY_ID} from './background-catalogue.mjs';
/** Dormant streaming controller. Only caller-verified catalogue recordings can play.
 * play/prime/resume invoke HTMLAudioElement.play synchronously in the caller's gesture.
 * prime plays only the selected real track with an output gate closed. Its promise
 * carries a single-use activationToken; activate(token) is reserved for successful
 * client activity-lock ownership. No-argument/stale activation fails closed.
 * Returned booleans describe request ownership, never proof of hearing or device support.
 * Native media requests may carry same-origin browser cookies; no practice data is sent.
 */
export function createBackgroundAudio({catalogue=BACKGROUND_BY_ID,createMediaElement=()=>{if(typeof globalThis.Audio!=='function')throw Error('此浏览器不支持媒体播放');return new globalThis.Audio()},visibilityTarget=globalThis.document,pageTarget=globalThis.window,schedule=setTimeout,cancel=clearTimeout,now=()=>globalThis.performance?.now?.()??Date.now(),playTimeoutMs=15000}={}){
 let current=null,generation=0,closed=false,hidden=!!visibilityTarget?.hidden,volume=.09,muted=false,state='idle',reason=null,error=null,selectedId=null,fadeGain=1,fadeTask=null,timerEnded=false,outputEnabled=false;
 if(!Number.isFinite(playTimeoutMs)||playTimeoutMs<100||playTimeoutMs>60000)throw RangeError('playTimeoutMs must be between 100 and 60000');
 const subscribers=new Set(),pendingRequests=new Map();const CANCELLED=Symbol('cancelled');let bufferTask=null;
 const pauseElement=element=>{try{element.pause()}catch{}};
 const time=value=>Number.isFinite(value)&&value>=0?value:null;
 function status(){return{state,reason,error,selectedId,activeId:current?.id||null,playing:outputEnabled&&(state==='playing'||state==='fading')&&!hidden&&!closed&&!current?.element.paused,volume,muted,outputEnabled,mediaPlaying:!!current&&!current.element.paused&&current.element.readyState>=2,loop:current?.loop||false,hidden,closed,currentTime:time(current?.element.currentTime),duration:time(current?.element.duration)}}
 function emit(){const snapshot=status();for(const listener of subscribers){try{listener(snapshot)}catch{}}}
 function cancelRequests(){for(const request of pendingRequests.values()){cancel(request.timer);request.resolve(CANCELLED)}pendingRequests.clear()}
 function cancelBuffer(){if(bufferTask!==null){cancel(bufferTask);bufferTask=null}}
 function watchBuffer(entry){if(bufferTask!==null)return;const token=entry.requestToken;bufferTask=schedule(()=>{bufferTask=null;if(owned(entry,token)&&['loading','priming'].includes(state)){generation++;cancelRequests();pauseElement(entry.element);reason='loading-timeout';fail('录音加载超时，请检查网络后重新点击播放')}},playTimeoutMs)}
 function cancelFade(){if(fadeTask!==null){cancel(fadeTask);fadeTask=null}fadeGain=1}
 function gain(){if(current){current.element.volume=volume*fadeGain;current.element.muted=muted||!outputEnabled}}
 function allowed(id){if(typeof id!=='string')throw Error('请选择已核授权曲目');const item=catalogue?.[id],url=item?.recording?.mediaUrl;if(!item||item.available!==true||item.recorded!==true||item.recording?.licenseVerified!==true||typeof url!=='string'||!/^\/practice\/audio\/background\/[a-f0-9]{16,64}\.mp3$/.test(url)||url.includes('..'))throw Error('此曲目没有可用的已核授权录音');return item}
 function release(entry){if(!entry)return;entry.element.muted=true;entry.activationToken=null;entry.detach();pauseElement(entry.element);try{entry.element.removeAttribute('src');entry.element.load()}catch{}}
 function stop(stopReason='user'){outputEnabled=false;generation++;cancelRequests();cancelBuffer();cancelFade();const previous=current;current=null;release(previous);state=closed?'closed':'stopped';reason=stopReason;error=null;emit()}
 function fail(message,kind='error'){outputEnabled=false;if(current){current.activationToken=null;current.element.muted=true}state=kind;error=message;emit();return false}
 function owned(entry,token){return !closed&&!hidden&&current===entry&&entry.requestToken===token&&generation===token}
 function preserveNewOwner(entry,token){if(current?.element===entry.element&&current.requestToken!==token)return;entry.element.muted=true;pauseElement(entry.element)}
 function request(entry){
  cancelRequests();cancelBuffer();const token=++generation;entry.requestToken=token;state=outputEnabled?'loading':'priming';reason=null;error=null;gain();let pending;
  // No storage, fetch, event wait or promise continuation precedes this call.
  try{pending=entry.element.play()}catch{generation++;pauseElement(entry.element);return Promise.resolve(fail('播放未能开始，请重新点击播放'))}
  const base=Promise.resolve(pending);
  // Observe even a late native completion after our own timeout/cancellation.
  base.then(()=>{if(!owned(entry,token)||timerEnded)preserveNewOwner(entry,token)},()=>{});
  if(!owned(entry,token)||timerEnded)return base.then(()=>false,()=>false);
  const deadline=new Promise((resolve,reject)=>{const timer=schedule(()=>{pendingRequests.delete(token);reject(Object.assign(Error('timeout'),{name:'PlaybackTimeoutError'}))},playTimeoutMs);pendingRequests.set(token,{timer,resolve})});
  emit();
  return Promise.race([base,deadline]).then(value=>{if(value===CANCELLED)return false;if(!owned(entry,token)||timerEnded){preserveNewOwner(entry,token);return false}if(!entry.element.paused&&entry.element.readyState>=2){state=outputEnabled?'playing':'primed';cancelBuffer()}emit();return true},exception=>{if(!owned(entry,token))return false;generation++;cancelBuffer();pauseElement(entry.element);return fail(exception?.name==='NotAllowedError'?'浏览器未允许声音，请再次点击播放':exception?.name==='PlaybackTimeoutError'?'录音加载超时，请检查网络后重新点击播放':'录音暂时无法播放，请检查网络或重新选择',exception?.name==='NotAllowedError'?'blocked':'error')}).finally(()=>{const request=pendingRequests.get(token);if(request){cancel(request.timer);pendingRequests.delete(token)}});
 }
 function bind(entry){
  const listeners=[];
  const on=(name,handler)=>{entry.element.addEventListener(name,handler);listeners.push([name,handler])};
  const active=()=>owned(entry,entry.requestToken);
  on('playing',()=>{if(!active()){preserveNewOwner(entry,entry.requestToken);return}if(state!=='fading')state=outputEnabled?'playing':'primed';cancelBuffer();error=null;emit()});
  for(const name of ['waiting','stalled','loadstart'])on(name,()=>{if(active()){if(state!=='fading'){state=outputEnabled?'loading':'priming';watchBuffer(entry)}emit()}});
  on('loadedmetadata',()=>{if(active())emit()});
  on('pause',()=>{if(active()){if(timerEnded){stop('timer-ended');return}generation++;cancelRequests();cancelBuffer();cancelFade();entry.activationToken=null;state='paused';reason='media-paused';emit()}});
  on('ended',()=>{if(active()){generation++;cancelRequests();cancelBuffer();cancelFade();timerEnded=true;outputEnabled=false;entry.activationToken=null;entry.element.muted=true;state='ended';reason='track-ended';emit()}});
  on('error',()=>{if(!active())return;generation++;cancelRequests();cancelBuffer();pauseElement(entry.element);cancelFade();const code=entry.element.error?.code;fail(code===3?'浏览器无法解码此录音，请重新选择':code===4?'此录音格式暂不支持，请重新选择':'录音加载失败，请检查网络后重试')});
  entry.detach=()=>{for(const [name,handler]of listeners)entry.element.removeEventListener(name,handler)};
 }
 function begin(id,{loop=false}={},priming=false){
  if(closed)return Promise.resolve(false);if(hidden)return Promise.resolve(fail('页面在后台，请返回后手动播放','blocked'));
  let item;try{item=allowed(id);if(typeof loop!=='boolean')throw Error('请明确选择是否整曲循环')}catch(exception){stop('invalid-track');return Promise.resolve(fail(exception.message))}
  generation++;cancelRequests();cancelBuffer();cancelFade();release(current);current=null;timerEnded=false;selectedId=id;outputEnabled=!priming;
  let element;try{element=createMediaElement();if(!element||typeof element.play!=='function'||typeof element.pause!=='function'||typeof element.addEventListener!=='function'||typeof element.removeEventListener!=='function')throw Error();element.preload='none';element.autoplay=false;element.crossOrigin='anonymous';element.loop=loop;element.src=item.recording.mediaUrl}catch{return Promise.resolve(fail('此浏览器无法创建录音播放器'))}
  const activationToken=priming?Symbol('background-prime'):null;const entry={id,loop,element,requestToken:0,activationToken,hadActivation:!priming,mode:priming?'prime':'manual',detach(){}};current=entry;gain();bind(entry);const promise=request(entry);if(priming)Object.defineProperty(promise,'activationToken',{value:activationToken,writable:false,configurable:false,enumerable:false});return promise;
 }
 function play(id,options){return begin(id,options,false)}
 function prime(id,options){return begin(id,options,true)}
 function activate(token){if(!current||token==null||current.activationToken!==token||!owned(current,current.requestToken)||timerEnded||!['priming','primed'].includes(state))return false;current.activationToken=null;current.hadActivation=true;outputEnabled=true;gain();state=!current.element.paused&&current.element.readyState>=2?'playing':'loading';emit();return true}
 function pause(){if(closed||!current)return false;if(timerEnded||state==='fading'){stop('timer-ended');return false}generation++;cancelRequests();cancelBuffer();cancelFade();current.activationToken=null;pauseElement(current.element);state='paused';reason='user';error=null;emit();return true}
 function resume(){if(closed||hidden||!current||timerEnded||state==='ended')return Promise.resolve(false);cancelFade();outputEnabled=current.mode==='manual'||current.hadActivation;return request(current)}
 function handleVisibilityChange(value){hidden=!!value;if(hidden){stop('background')}else emit()}
 function finishTimer({fadeMs=800}={}){
  if(!Number.isFinite(fadeMs)||fadeMs<0||fadeMs>10000)throw RangeError('fadeMs must be between 0 and 10000');
  if(closed)return;timerEnded=true;cancelRequests();cancelBuffer();if(!current||current.element.paused||hidden||fadeMs===0||state!=='playing'){stop('timer-ended');return}
  cancelFade();const entry=current,token=++generation;entry.requestToken=token;const started=now();state='fading';reason='timer-ended';emit();
  const tick=()=>{fadeTask=null;if(closed||hidden||current!==entry||generation!==token)return;const elapsed=now()-started;if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=fadeMs){stop('timer-ended');return}fadeGain=Math.min(fadeGain,Math.max(0,1-elapsed/fadeMs));gain();emit();fadeTask=schedule(tick,Math.min(50,fadeMs-elapsed))};
  fadeTask=schedule(tick,Math.min(50,fadeMs));
 }
 const visibility=()=>handleVisibilityChange(!!visibilityTarget.hidden),pagehide=()=>handleVisibilityChange(true),pageshow=()=>handleVisibilityChange(!!visibilityTarget?.hidden);
 visibilityTarget?.addEventListener?.('visibilitychange',visibility);pageTarget?.addEventListener?.('pagehide',pagehide);pageTarget?.addEventListener?.('pageshow',pageshow);
 return{play,prime,activate,pause,resume,stop,finishTimer,handleVisibilityChange,status,
  setVolume(value){if(!Number.isFinite(value))throw RangeError('volume must be finite');volume=Math.max(0,Math.min(1,value));gain();emit()},
  setMuted(value){muted=!!value;gain();emit()},
  subscribe(listener){if(typeof listener!=='function')throw TypeError('listener required');subscribers.add(listener);return()=>subscribers.delete(listener)},
  close(){if(closed)return;closed=true;stop('closed');visibilityTarget?.removeEventListener?.('visibilitychange',visibility);pageTarget?.removeEventListener?.('pagehide',pagehide);pageTarget?.removeEventListener?.('pageshow',pageshow);subscribers.clear()}
 };
}
