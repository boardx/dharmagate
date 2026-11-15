/** Narrow retained-worker integration for the selected-recording preparation repair.
 * Sources are explicit build-time browser modules; no media, binding or user state is changed.
 */
export function createPracticeCueRepairWorker(current,{audioSource,clientSource}={}){
 if(typeof current?.fetch!=='function')throw Error('RETAINED_PRACTICE_WORKER_REQUIRED');
 if([audioSource,clientSource].some(s=>typeof s!=='string'||s.length===0||s.length>250000))throw Error('PINNED_PRACTICE_MODULES_REQUIRED');
 const modules=new Map([['/practice/audio-engine.js',audioSource],['/practice/client.js',clientSource]]);
 return Object.freeze({async fetch(request,env,ctx){
  const source=modules.get(new URL(request.url).pathname);
  if(source===undefined)return current.fetch(request,env,ctx);
  const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,allow:'GET, HEAD'}});
  return new Response(request.method==='HEAD'?null:source,{headers:{...headers,'content-type':'text/javascript;charset=utf-8'}});
 }});
}
