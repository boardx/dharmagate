import {canonSatCoverageHtml} from './canon-sat-coverage.mjs';
/** Adds an honest coverage notice; does not replace canon data, rendering or authorization. */
export function withSatCoverage(current){
 if(typeof current?.fetch!=='function')throw Error('EXPLICIT_EXISTING_WORKER_REQUIRED');
 return {async fetch(request,env,ctx){
  const response=await current.fetch(request,env,ctx),path=new URL(request.url).pathname;
  if(request.method!=='GET'||!['/canon/zh','/canon/zh/'].includes(path)||response.status!==200||!response.headers.get('content-type')?.includes('text/html')||request.headers.has('rsc')||request.headers.has('next-router-state-tree'))return response;
  const headers=new Headers(response.headers);for(const key of ['content-length','content-encoding','etag','content-md5','digest','content-digest','repr-digest','last-modified'])headers.delete(key);
  const page=new Response(response.body,{status:response.status,statusText:response.statusText,headers});let inserted=false;
  return new HTMLRewriter().on('main',{element(element){if(!inserted){inserted=true;element.prepend(canonSatCoverageHtml(),{html:true})}}}).transform(page);
 }};
}
