/** Reuses only an explicitly stored duration; never invents historical cues or starts audio. */
export function reusableMinutes(record){
 const seconds=record?.plannedSeconds;
 return Number.isInteger(seconds)&&seconds>=60&&seconds<=10800&&seconds%60===0?seconds/60:null;
}
export function cueTimeline({minutes,preparationSeconds,intervalMinutes,count,startName,intervalName,endName,intervalSilent=false}){
 if(!Number.isInteger(minutes)||minutes<1||minutes>180||![0,10,30].includes(preparationSeconds)||!Number.isInteger(intervalMinutes)||intervalMinutes<0||!Number.isInteger(count)||count<0)throw Error('INVALID_TIMELINE');
 return `${preparationSeconds?'准备'+preparationSeconds+'秒 → ':''}开始：${startName} → ${count?'间隔：每'+intervalMinutes+'分钟'+intervalName+'，'+count+'个节点'+(intervalSilent?'（无声）':''):'间隔：无'} → ${minutes}分钟结束：${endName}。提前结束不响结束提示。`;
}
