import {createFilmLibrary} from './film-library.mjs';

const navigationPaths = new Set(['/','/zh','/en','/zh/library','/en/library','/zh/articles','/en/articles','/canon','/research','/whitepaper']);
export function createFilmWorker(currentWorker) {
 const library=createFilmLibrary();
 return {async fetch(request,env,ctx) {
  const owned=library.fetch(request);if(owned)return owned;
  const response=await currentWorker.fetch(request,env,ctx);
  if(!['GET','HEAD'].includes(request.method)||!navigationPaths.has(new URL(request.url).pathname)||response.status!==200||!response.headers.get('content-type')?.includes('text/html'))return response;
  const headers=new Headers(response.headers);
  for(const key of ['content-length','content-encoding','etag','content-md5','digest','content-digest','repr-digest','last-modified'])headers.delete(key);
  if(request.method==='HEAD')return new Response(null,{status:response.status,headers});
  // Stream the existing page; only its established desktop/mobile product nav changes.
  const page=new Response(response.body,{status:response.status,headers});
  return new HTMLRewriter().on('nav.dg-primary, nav[aria-label="移动导航"]',{
   element(element){element.append('<a href="/films">佛教影视</a>',{html:true});}
  }).transform(page);
 }};
}
