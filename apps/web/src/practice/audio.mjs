import {PLAYABLE_SOUND_IDS,SOUND_BY_ID,CUE_IDS} from './sound-catalogue.mjs';
/** Original synthesis only. 0.6 master headroom is digital gain, never an ear-level dB guarantee. */
export const MASTER_HEADROOM=.6;
// Digital dynamic-range protection; not a true-peak meter or an ear-level safety limit.
export const OUTPUT_COMPRESSOR=Object.freeze({threshold:-12,knee:0,ratio:20,attack:.003,release:.15});
export function createPracticeAudio({createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),getAudioSession=()=>globalThis.navigator?.audioSession,random=Math.random,schedule=setTimeout,cancel=clearTimeout,scheduleUnlock=setTimeout,cancelUnlock=clearTimeout,unlockTimeoutMs=8000}={}){
 let context=null,master=null,limiter=null,roots=new Set(),current=[],all=new Set(),tasks=new Set(),generation=0,volume=.09,muted=false,closed=false,cues=new Set(),background=new Set(),backgroundKind=null,activeCueId=null,cueKind=null,nextCueId=0,unlockState='idle',sessionMode='unavailable',unlockPromise=null,rejectUnlock=null,stateListener=null,cueBurstVoices=0,cueBurstPending=false,audioSession=null,sessionListener=null;
 const track=node=>{all.add(node);return node};
 function cleanup(nodes){current=current.filter(n=>!nodes.includes(n));for(const n of nodes){try{n.stop?.()}catch{}try{n.disconnect()}catch{}all.delete(n);cues.delete(n);background.delete(n)}if(cues.size===0){activeCueId=null;cueKind=null}if(background.size===0)backgroundKind=null}
 function ramp(gain,value,seconds=.08){if(!context)return;const at=context.currentTime;gain.gain.cancelScheduledValues(at);gain.gain.setValueAtTime(gain.gain.value,at);gain.gain.linearRampToValueAtTime(value,at+seconds)}
 function after(fn,ms){let id=schedule(()=>{tasks.delete(id);fn()},ms);tasks.add(id)}
 function interruptGraph(){if(closed)return;const voices=[...all].filter(node=>!roots.has(node));if(voices.length){generation++;cleanup(voices)}if(unlockState==='ready')unlockState='blocked'}
 function sessionState(){try{return audioSession?.state||'unavailable'}catch{return'unavailable'}}
 function ready(){
  if(closed)return Promise.reject(Error('音频会话已关闭'));
  // Setting a playback session and invoking resume happen in this call stack, before any await.
  try{const session=getAudioSession();if(session!==audioSession){if(audioSession&&sessionListener)audioSession.removeEventListener?.('statechange',sessionListener);audioSession=session;sessionListener=null;if(session&&typeof session.addEventListener==='function'&&typeof session.removeEventListener==='function'){sessionListener=()=>{if(sessionState()==='interrupted')interruptGraph()};session.addEventListener('statechange',sessionListener)}}if(session){session.type='playback';sessionMode=session.type==='playback'?'playback':'unsupported'}else sessionMode='unavailable'}catch{sessionMode='unsupported'}
  if(!context){try{context=createContext();master=track(context.createGain());roots.add(master);master.gain.value=muted?0:volume*MASTER_HEADROOM;if(typeof context.createDynamicsCompressor==='function'){try{limiter=track(context.createDynamicsCompressor());for(const [key,value]of Object.entries(OUTPUT_COMPRESSOR))limiter[key].value=value;roots.add(limiter);master.connect(limiter);limiter.connect(context.destination)}catch{if(limiter){roots.delete(limiter);cleanup([limiter]);limiter=null}master.disconnect();master.connect(context.destination)}}else master.connect(context.destination);stateListener=()=>{if(!closed&&context.state!=='running')interruptGraph()};if(context.addEventListener)context.addEventListener('statechange',stateListener);else context.onstatechange=stateListener}catch{unlockState='blocked';return Promise.reject(Error('此浏览器无法创建音频，请换用 Safari 并再次点启用声音'))}}
  if(unlockPromise)return unlockPromise;
  unlockState='unlocking';let resumed;try{resumed=context.resume()}catch{unlockState='blocked';return Promise.reject(Error('浏览器拒绝音频，请再次点击启用声音'))}
  let timeout;const waiting=new Promise((resolve,reject)=>{rejectUnlock=reject;timeout=scheduleUnlock(()=>reject(Error('声音启用超时，请再次点击启用声音')),unlockTimeoutMs);Promise.resolve(resumed).then(resolve,reject)});
  unlockPromise=waiting.then(()=>{if(closed)throw Error('音频会话已关闭');if(context?.state!=='running'||sessionState()==='interrupted')throw Error('声音仍被暂停，请再次点击启用声音');unlockState='ready';return context}).catch(error=>{unlockState=closed?'closed':'blocked';throw error}).finally(()=>{cancelUnlock(timeout);unlockPromise=null;rejectUnlock=null});
  return unlockPromise;
 }
 function stop(){generation++;const nodes=current;current=[];cues.clear();background.clear();activeCueId=null;cueKind=null;backgroundKind=null;for(const n of nodes)if(n._practiceFade)ramp(n,0);if(nodes.length)after(()=>cleanup(nodes),120)}
 function stopCues(){const nodes=[...cues];cues.clear();activeCueId=null;cueKind=null;current=current.filter(node=>!nodes.includes(node));for(const node of nodes)if(node._practiceFade)ramp(node,0);if(nodes.length)after(()=>cleanup(nodes),120)}
 function waveform(kind,seconds){
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*seconds),context.sampleRate),data=buffer.getChannelData(0),bands=Array(6).fill(0),poles=[.998,.99,.96,.88,.65,.3];let brown=0,low=0,grain=0,peak=0;
  const tones={
   'a-major':[[220,.35],[277.125,.23],[329.625,.2]],'d-major':[[146.875,.35],[185,.23],[220,.2]],
   'om-drone':[[110,.36],[165,.16],[220,.1],[330,.07]],humming:[[174.625,.35],[349.25,.16],[523.875,.08]],solfeggio:[[396,.28],[528,.22],[660,.16]],
   'basu-bowl':[[196,.46],[531.16,.16],[1064.28,.08]],'wind-gong':[[74,.4],[108.78,.24],[193.88,.13],[303.4,.08]],'rav-drum':[[146.83,.4],[220,.24],[293.66,.15]],'tuning-fork':[[440,.58],[880,.04]],'crystal-bowl':[[329.63,.4],[331.1,.17],[659.26,.1]],handpan:[[196,.43],[392,.19],[588,.11]],'church-bell':[[130.8,.2],[261.6,.35],[313.92,.18],[627.84,.13],[784.8,.07]]
  };
  for(let i=0;i<data.length;i++){
   const t=i/context.sampleRate,white=random()*2-1;let value=0;brown=(brown+.02*white)/1.02;low=.96*low+.04*white;
   if(kind==='brown')value=brown*3.5;
   else if(kind==='pink'){for(let b=0;b<bands.length;b++)bands[b]=poles[b]*bands[b]+(1-poles[b])*white;value=bands.reduce((a,b)=>a+b,0)*.42}
   else if(kind==='rain'){grain=grain*.92+(random()<.003?white*.8:0);value=white*.25+grain*.35}
   else if(kind==='ocean')value=(white*.2+low*1.2)*(.2+.8*Math.pow((1-Math.cos(2*Math.PI*t/seconds))/2,1.5));
   else if(kind==='wild-wind')value=(low*2.5+white*.04)*(.35+.3*Math.sin(2*Math.PI*t/seconds)+.2*Math.sin(6*Math.PI*t/seconds));
   else if(kind==='rainstick'){grain=grain*.85+(random()<.015?white:0);value=(white*.08+grain*.5)*Math.sin(Math.PI*Math.min(1,t/seconds))}
   else if(kind==='frame-drum')value=Math.sin(2*Math.PI*94*t)*Math.exp(-t*7)*.7+Math.sin(2*Math.PI*162*t)*Math.exp(-t*16)*.2+white*.25*Math.exp(-t*30);
   else{
    for(const [frequency,level]of tones[kind]||[]){let phase=2*Math.PI*frequency*t;if(kind==='humming')phase+=.09*Math.sin(2*Math.PI*5*t);if(kind==='wind-gong')phase+=.2*Math.sin(2*Math.PI*.7*t);value+=Math.sin(phase)*level}
    if(SOUND_BY_ID[kind]?.continuous)value*=kind==='om-drone'?(.65+.25*Math.sin(2*Math.PI*t/seconds)):.85;
    else{const decay=kind==='wind-gong'?1:kind==='crystal-bowl'?.65:kind==='tuning-fork'?1.25:1.6,attack=kind==='wind-gong'?.12:kind==='crystal-bowl'?.06:.006;value*=(1-Math.exp(-t/attack))*Math.exp(-t*decay)}
   }
   // Short edge crossfades avoid loop discontinuity/clicks; every recipe has a distinct signal.
   const edge=Math.min(1,t/.02,(seconds-t)/.02);data[i]=value*Math.max(0,edge);peak=Math.max(peak,Math.abs(data[i]));
  }
  // Bound peaks without turning silence into sound or compensating volume automatically.
  const scale=peak>.78?.78/peak:1;for(let i=0;i<data.length;i++)data[i]*=scale;
  return buffer;
 }
 function retireFallbackTails(){if(!limiter)cleanup([...all].filter(node=>!roots.has(node)&&!current.includes(node)))}
 function sound(kind,{overlay=false}={}){
  retireFallbackTails();
  if(!overlay&&all.size>25)cleanup([...all].filter(node=>!roots.has(node)));
  const continuous=SOUND_BY_ID[kind].continuous,duration=continuous?8:kind==='frame-drum'?1.2:kind==='rainstick'?8:kind==='crystal-bowl'?7:6;
  const source=track(context.createBufferSource()),fade=track(context.createGain());source.buffer=waveform(kind,duration);source.loop=continuous;fade.gain.value=0;fade._practiceFade=true;source.connect(fade);fade.connect(master);ramp(fade,1,.03);source.start();if(overlay)current.push(source,fade);else current=[source,fade];if(continuous){background=new Set(current);backgroundKind=kind}else{cues=new Set([source,fade]);activeCueId=++nextCueId;cueKind=kind}if(!continuous){source.stop(context.currentTime+duration);after(()=>cleanup([source,fade]),(duration+.05)*1000)}
 }
 function cue(kind){
  if(kind==='silent')return false;
  if(!CUE_IDS.includes(kind))throw Error('UNKNOWN_CUE');
  if(!context||closed||context.state!=='running'||sessionState()==='interrupted'||cues.size>0)return false;
  const cost=['soft-bell','deep-bell'].includes(kind)?3:kind==='wood'?2:1;if(cueBurstVoices+cost>15)return false;cueBurstVoices+=cost;if(!cueBurstPending){cueBurstPending=true;after(()=>{cueBurstPending=false;cueBurstVoices=0},120)}
  retireFallbackTails();if(all.size>25)return false;
  if(!['soft-bell','deep-bell','wood'].includes(kind)){sound(kind,{overlay:true});return true}
  const nodes=[],wood=kind==='wood',duration=wood?.22:3.5,base=kind==='deep-bell'?110:wood?460:220;
  for(const [ratio,level]of wood?[[1,.35],[1.47,.12]]:[[1,.4],[2.756,.13],[5.404,.04]]){
   const osc=track(context.createOscillator()),gain=track(context.createGain()),at=context.currentTime;nodes.push(osc,gain);gain._practiceFade=true;osc.type='sine';osc.frequency.value=base*ratio;
   gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.01);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain);gain.connect(master);osc.start();osc.stop(at+duration+.05);
  }
  current.push(...nodes);activeCueId=++nextCueId;cueKind=kind;for(const node of nodes)cues.add(node);after(()=>cleanup(nodes),(duration+.15)*1000);return true;
 }
 function bell(){return cue('soft-bell')}
 return {async prepare(){await ready();return true},async play(kind){if(!PLAYABLE_SOUND_IDS.includes(kind))throw Error('UNKNOWN_SOUND');stop();const request=++generation;await ready();if(closed||request!==generation)return false;if(kind==='bell')return bell();sound(kind);return true},cue,bell,stop,stopCues,setVolume(value){if(!Number.isFinite(value)||value<0||value>1)throw Error('INVALID_VOLUME');volume=value;if(master)ramp(master,muted?0:volume*MASTER_HEADROOM)},setMuted(value){muted=!!value;if(master)ramp(master,muted?0:volume*MASTER_HEADROOM)},status(){const running=context?.state==='running'&&!closed&&sessionState()!=='interrupted';return{ready:running,playing:running&&current.length>0,backgroundPlaying:running&&background.size>0,cuePlaying:running&&cues.size>0,backgroundKind,activeCueId,cueKind,muted,volume,closed,contextState:closed?'closed':context?.state||'uninitialized',sessionMode,sessionState:sessionState(),outputProtection:limiter?'compressor':'single-graph-fallback',unlockState:closed?'closed':unlockState}},async close(){if(closed)return;closed=true;unlockState='closed';if(audioSession&&sessionListener)audioSession.removeEventListener?.('statechange',sessionListener);audioSession=null;sessionListener=null;rejectUnlock?.(Error('音频会话已关闭'));generation++;for(const task of tasks)cancel(task);tasks.clear();cleanup([...all]);current=[];master=null;limiter=null;roots.clear();if(context){if(context.removeEventListener)context.removeEventListener('statechange',stateListener);else context.onstatechange=null;await context.close();context=null}}};
}
