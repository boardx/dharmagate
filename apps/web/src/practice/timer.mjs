export function minutesValue(value){const n=typeof value==='string'&&value.trim()!==''?Number(value):value;if(!Number.isInteger(n)||n<1||n>180)throw new RangeError('请设置1至180分钟的整数时长');return n;}
/** Dual-clock difference tolerance is 5 seconds, not timer resolution. Explicit now retains deterministic legacy semantics. */
export function createMeditationTimer({wallNow=Date.now,monotonicNow=()=>globalThis.performance.now()}={}){
 let state='idle',duration=1200000,preparation=10000,remaining=duration+preparation,deadline=null,interval=0,baseline=null,clockUncertain=false,clockReason=null;
 const finite=Number.isFinite;
 function uncertain(reason){state='paused';deadline=null;baseline=null;clockUncertain=true;clockReason=reason}
 function clocks(){try{return{wall:wallNow(),mono:monotonicNow()}}catch{return{wall:NaN,mono:NaN}}}
 function anchor(explicit){if(explicit!==undefined){if(!finite(explicit))throw Error('INVALID_CLOCK');deadline=explicit+remaining;baseline=null;return true}const c=clocks();if(!finite(c.wall)||!finite(c.mono)){uncertain('invalid-clock');return false}baseline=c;deadline=c.wall+remaining;return true}
 function snapshot(now){
  if(now!==undefined&&!finite(now))throw Error('INVALID_CLOCK');
  if(state==='running'){
   if(now!==undefined)remaining=Math.max(0,Math.min(duration+preparation,deadline-now));
   else {const c=clocks();if(!finite(c.wall)||!finite(c.mono)){uncertain('invalid-clock')}else if(!baseline){uncertain('clock-mode-changed')}else{const wall=c.wall-baseline.wall,mono=c.mono-baseline.mono;if(mono<0||wall<0||Math.abs(wall-mono)>5000)uncertain('clock-discontinuity');else{remaining=Math.max(0,remaining-mono);baseline=c;deadline=c.wall+remaining}}}
   if(state==='running'&&remaining===0){state='finished';deadline=null;baseline=null}
  }
  const meditationRemaining=Math.min(duration,remaining),preparing=remaining>duration;
  return{state,phase:state==='idle'?'ready':preparing?'preparation':state==='finished'?'finished':'meditation',remainingMs:remaining,phaseRemainingMs:state==='idle'?duration:preparing?remaining-duration:meditationRemaining,durationMs:duration,preparationMs:preparation,preparationRemainingMs:Math.max(0,remaining-duration),meditationElapsedMs:duration-meditationRemaining,lastConfirmedElapsedMs:duration-meditationRemaining,clockUncertain,clockReason,intervalsCompleted:interval?Math.floor((duration-meditationRemaining)/interval):0,progress:(duration+preparation-remaining)/(duration+preparation)}
 }
 return{snapshot,restore({elapsedSeconds,preparationRemainingMs=0}){
  if(!Number.isInteger(elapsedSeconds)||elapsedSeconds<0||elapsedSeconds>=duration/1000||!finite(preparationRemainingMs)||preparationRemainingMs<0||preparationRemainingMs>preparation||(elapsedSeconds>0&&preparationRemainingMs>0))throw Error('INVALID_CHECKPOINT');
  if(state==='running'||state==='paused')throw Error('TIMER_ALREADY_ACTIVE');remaining=duration-elapsedSeconds*1000+preparationRemainingMs;state='paused';deadline=null;baseline=null;clockUncertain=false;clockReason=null;return snapshot();
 },configure({minutes=20,preparationSeconds=10,intervalMinutes=0}={}){
  if(state==='running'||state==='paused')throw Error('结束本次计时后再修改设置');const nextDuration=minutesValue(minutes)*60000;if(![0,10,30].includes(Number(preparationSeconds)))throw Error('INVALID_PREPARATION');const v=Number(intervalMinutes);if(!Number.isInteger(v)||v<0||v>180)throw Error('INVALID_INTERVAL');duration=nextDuration;preparation=Number(preparationSeconds)*1000;interval=v*60000;remaining=duration+preparation;state='idle';deadline=null;baseline=null;clockUncertain=false;clockReason=null;return snapshot();
 },start(now){if(!['idle','finished'].includes(state))throw Error('TIMER_ALREADY_ACTIVE');remaining=duration+preparation;state='running';clockUncertain=false;clockReason=null;anchor(now);return snapshot(now)},pause(now){const s=snapshot(now);if(s.state!=='running')return s;state='paused';deadline=null;baseline=null;return snapshot(now)},resume(now){if(state!=='paused')throw Error('TIMER_NOT_PAUSED');state='running';clockUncertain=false;clockReason=null;anchor(now);return snapshot(now)},finish(now){if(now!==undefined&&!finite(now))throw Error('INVALID_CLOCK');remaining=duration+preparation;deadline=null;baseline=null;state='idle';clockUncertain=false;clockReason=null;return snapshot(now)}};
}
