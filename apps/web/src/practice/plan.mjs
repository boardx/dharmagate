export function intervalPlan(minutes,intervalMinutes,preparationSeconds=0){
 if(!Number.isInteger(minutes)||minutes<1||minutes>180||!Number.isInteger(intervalMinutes)||intervalMinutes<0||intervalMinutes>180||![0,10,30].includes(preparationSeconds))throw Error('INVALID_PLAN');
 const duration=minutes*60,interval=intervalMinutes*60,count=interval?Math.floor((duration-1)/interval):0;
 return {count,offsets:Array.from({length:count},(_,i)=>preparationSeconds+(i+1)*interval),startAfterSeconds:preparationSeconds,endAfterSeconds:preparationSeconds+duration};
}
export function restoredVolume(saved){if(!Number.isInteger(saved)||saved<0||saved>100)throw Error('INVALID_VOLUME');return {volume:Math.min(saved,25),needsConfirmation:saved>25,savedVolume:saved}}
