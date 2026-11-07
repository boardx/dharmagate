/** Presentation-only overlay. The verified original-byte and reading-model checks stay in the base worker. */
export function transformCanonControls(source,{oldTreeClient,newTreeClient}){
 const replace=(before,after)=>{if(!source.includes(before)||source.split(before).length!==2)throw Error('CANON_UI_BASE_MISMATCH');source=source.replace(before,after)};
 replace(oldTreeClient,newTreeClient);
 replace('let cataloguePage=1,total=0',"let cataloguePage=/^[1-9]\\d{0,3}$/.test(params.get('cataloguePage')||'')?Number(params.get('cataloguePage')):1,total=0");
 replace("function browseUrl(){const p=new URLSearchParams({view});","function browseUrl(){const p=new URLSearchParams({view});if(view==='list')p.set('cataloguePage',cataloguePage);const live=new URL(location.href).searchParams;if(live.get('expanded'))p.set('expanded',live.get('expanded'));");
 replace("if(params.get('open'))p.set('open',params.get('open'));","if(live.get('open'))p.set('open',live.get('open'));");
 replace('async function list(){const generation=',"async function list(){document.getElementById('canon-retry')?.remove();const generation=");
 replace("const fail=e=>status(e.message||'讀取失敗');", "const fail=e=>{status(e.message||'讀取失敗');document.getElementById('canon-retry')?.remove();const retry=make('button',unit?'重試載入原文':'重試目前篩選');retry.id='canon-retry';retry.type='button';retry.onclick=()=>{retry.remove();(unit?loadBook():list()).catch(fail)};$('status').after(retry)};");
 replace("const bytes=await source.arrayBuffer();", "status('正在下載權威原件…');const bytes=await source.arrayBuffer();status('正在核對原件字節與校驗碼…');");
 replace("originalView=DharmaGateTEI.convertPublisherXml", "status('正在整理閱讀呈現與校注…');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));originalView=DharmaGateTEI.convertPublisherXml");
 const close='if(unit)loadBook().catch(fail);else list().catch(fail)';
 replace(close,"document.addEventListener('dharmagate:go-page',event=>{const next=event.detail;if(!Number.isSafeInteger(next)||next<1||!manifest?.pages?.length||next>manifest.pages.length)return;page=next;loadPage().then(()=>$('reading').scrollIntoView()).catch(fail)});"+close);
 return source;
}
export function createCanonExperienceWorker(current,{css,client,oldTreeClient,newTreeClient}){
 if(typeof current?.fetch!=='function'||![css,client,oldTreeClient,newTreeClient].every(v=>typeof v==='string'&&v.length))throw Error('CANON_UI_ASSETS_REQUIRED');
 return {async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(path==='/reading-experience/client.js'){
   if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{allow:'GET, HEAD'}});
   return new Response(request.method==='HEAD'?null:client,{headers:{'content-type':'text/javascript;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  const response=await current.fetch(request,env,ctx);
  const canon=path==='/canon/zh'||path==='/canon/zh/';
  if(request.method!=='GET'||response.status!==200)return response;
  if(path==='/canon/zh/client.js'){
   try{const script=transformCanonControls(await response.text(),{oldTreeClient,newTreeClient}),headers=new Headers(response.headers);for(const key of ['content-length','content-encoding','etag','content-md5','digest','content-digest','repr-digest','last-modified'])headers.delete(key);headers.set('cache-control','no-store');return new Response(script,{headers})}catch{return new Response('Verified UI base mismatch',{status:503,headers:{'cache-control':'no-store'}})}
  }
  if(!canon||request.headers.has('rsc')||request.headers.has('next-router-state-tree')||!response.headers.get('content-type')?.includes('text/html'))return response;
  const headers=new Headers(response.headers);for(const key of ['content-length','content-encoding','etag','content-md5','digest','content-digest','repr-digest','last-modified'])headers.delete(key);headers.set('x-dharmagate-canon-experience','five-rounds-20261107');
  return new HTMLRewriter().on('style[data-reading-style]',{element(e){e.append(css,{html:true})}}).transform(new Response(response.body,{headers}));
 }};
}
