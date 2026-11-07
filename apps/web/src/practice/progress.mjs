/** Geometry only: elapsed sitting time, never preparation, determines the sector. */
export function sectorPath(progress){
 if(!Number.isFinite(progress))throw Error('INVALID_PROGRESS');
 const p=Math.max(0,Math.min(1,progress));if(p===0)return '';
 if(p===1)return 'M100 4 A96 96 0 1 1 100 196 A96 96 0 1 1 100 4 Z';
 const angle=p*Math.PI*2-Math.PI/2,x=(100+96*Math.cos(angle)).toFixed(3),y=(100+96*Math.sin(angle)).toFixed(3);
 return `M100 100 L100 4 A96 96 0 ${p>0.5?1:0} 1 ${x} ${y} Z`;
}
export function sittingProgress(snapshot){if(!Number.isFinite(snapshot.durationMs)||snapshot.durationMs<=0||!Number.isFinite(snapshot.meditationElapsedMs))throw Error('INVALID_SNAPSHOT');return Math.max(0,Math.min(1,snapshot.meditationElapsedMs/snapshot.durationMs))}
