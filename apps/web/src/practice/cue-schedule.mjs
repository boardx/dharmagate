/** Pure observation cursor. Call reset for each new session; never schedules audio itself. */
export function createCueSchedule(){
 let started=false,ended=false,interval=0;
 const kinds=new Set(['silent','soft-bell','deep-bell','wood']);
 return {reset(){started=false;ended=false;interval=0},observe(snapshot,{startCue='silent',intervalCue='silent',endCue='silent',audible=true}={}){
  for(const kind of [startCue,intervalCue,endCue])if(!kinds.has(kind))throw new TypeError('INVALID_CUE');
  const events=[],emit=(kind,phase,index)=>{if(audible&&kind!=='silent')events.push({kind,phase,...(index===undefined?{}:{index})})};
  const count=Number.isInteger(snapshot.intervalsCompleted)&&snapshot.intervalsCompleted>=0?snapshot.intervalsCompleted:0;
  if(snapshot.state==='finished'){
   interval=Math.max(interval,count);started=true;
   if(!ended){ended=true;emit(endCue,'end')}
   return {events};
  }
  if(snapshot.state==='idle'||snapshot.phase==='preparation')return {events};
  if(snapshot.state!=='running'&&snapshot.state!=='paused')return {events};
  if(!started){started=true;if(snapshot.state==='running')emit(startCue,'start')}
  if(count>interval){interval=count;if(snapshot.state==='running')emit(intervalCue,'interval',count)}
  return {events};
 }};
}
