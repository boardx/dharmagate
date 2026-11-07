export function createPracticeAudio({createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),random=Math.random,schedule=setTimeout,cancel=clearTimeout}={}){
 let context=null,master=null,current=[],all=new Set(),tasks=new Set(),generation=0,volume=.09,muted=false,closed=false,cues=new Set(),background=new Set(),backgroundKind=null,activeCueId=null,cueKind=null,nextCueId=0;
 const track=node=>{all.add(node);return node};
 function cleanup(nodes){current=current.filter(n=>!nodes.includes(n));for(const n of nodes){try{n.stop?.()}catch{}try{n.disconnect()}catch{}all.delete(n);cues.delete(n);background.delete(n)}if(cues.size===0){activeCueId=null;cueKind=null}if(background.size===0)backgroundKind=null}
 function ramp(gain,value,seconds=.08){const at=context.currentTime;gain.gain.cancelScheduledValues(at);gain.gain.setValueAtTime(gain.gain.value,at);gain.gain.linearRampToValueAtTime(value,at+seconds)}
 function after(fn,ms){let id=schedule(()=>{tasks.delete(id);fn()},ms);tasks.add(id)}
 async function ready(){if(closed)throw Error('音频会话已关闭');if(!context){context=createContext();master=track(context.createGain());master.gain.value=muted?0:volume*.12;master.connect(context.destination)}await context.resume();if(closed||context.state!=='running')throw Error('浏览器未允许播放，请再次点击开始声音');return context}
 function stop(){generation++;const nodes=current;current=[];cues.clear();background.clear();activeCueId=null;cueKind=null;backgroundKind=null;for(const n of nodes)if(n._practiceFade)ramp(n,0);if(nodes.length)after(()=>cleanup(nodes),120)}
 function stopCues(){const nodes=[...cues];cues.clear();activeCueId=null;cueKind=null;current=current.filter(node=>!nodes.includes(node));for(const node of nodes)if(node._practiceFade)ramp(node,0);if(nodes.length)after(()=>cleanup(nodes),120)}
 function noise(kind){const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*4),context.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){const white=random()*2-1;last=(last+.02*white)/1.02;data[i]=kind==='brown'?Math.max(-1,Math.min(1,last*3.5)):white*.35}const source=track(context.createBufferSource());source.buffer=buffer;source.loop=true;const filter=track(context.createBiquadFilter());filter.type='lowpass';filter.frequency.value=kind==='brown'?650:1800;const fade=track(context.createGain());fade.gain.value=0;fade._practiceFade=true;source.connect(filter);filter.connect(fade);fade.connect(master);ramp(fade,1,.25);source.start();current=[source,filter,fade];background=new Set(current);backgroundKind=kind}
 function cue(kind){
  if(kind==='silent')return false;
  if(!['soft-bell','deep-bell','wood'].includes(kind))throw Error('UNKNOWN_CUE');
  if(!context||closed||context.state!=='running'||cues.size>0||all.size>25)return false;
  const nodes=[],wood=kind==='wood',duration=wood?.22:3.5,base=kind==='deep-bell'?110:wood?460:220;
  for(const [ratio,level]of wood?[[1,.35],[1.47,.12]]:[[1,.4],[2.756,.13],[5.404,.04]]){
   const osc=track(context.createOscillator()),gain=track(context.createGain()),at=context.currentTime;nodes.push(osc,gain);gain._practiceFade=true;osc.type='sine';osc.frequency.value=base*ratio;
   gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.01);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain);gain.connect(master);osc.start();osc.stop(at+duration+.05);
  }
  current.push(...nodes);activeCueId=++nextCueId;cueKind=kind;for(const node of nodes)cues.add(node);after(()=>cleanup(nodes),(duration+.15)*1000);return true;
 }
 function bell(){return cue('soft-bell')}

 return {async prepare(){await ready();return true},async play(kind){if(!['brown','rain','bell'].includes(kind))throw Error('UNKNOWN_SOUND');stop();const request=++generation;await ready();if(closed||request!==generation)return false;if(kind==='bell')return bell();noise(kind);return true},cue,bell,stop,stopCues,setVolume(value){if(!Number.isFinite(value)||value<0||value>1)throw Error('INVALID_VOLUME');volume=value;if(master)ramp(master,muted?0:volume*.12)},setMuted(value){muted=!!value;if(master)ramp(master,muted?0:volume*.12)},status(){return{ready:context?.state==='running',playing:current.length>0,backgroundPlaying:background.size>0,cuePlaying:cues.size>0,backgroundKind,activeCueId,cueKind,muted,volume,closed}},async close(){if(closed)return;closed=true;generation++;for(const task of tasks)cancel(task);tasks.clear();cleanup([...all]);current=[];master=null;if(context){await context.close();context=null}}};
}
