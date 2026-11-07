import {createVideoStudyLibrary} from './video-study-library.mjs';

// The exact current production Worker remains responsible for every existing
// route. Only the catalogue routes and links in public navigation are added.
export function withVideoStudy(currentWorker){
 if(typeof currentWorker?.fetch!=='function')throw new TypeError('A current Worker is required');
 const library=createVideoStudyLibrary();
 return {async fetch(request,env,ctx){
  const own=library.fetch(request);if(own)return own;
  const response=await currentWorker.fetch(request,env,ctx),path=new URL(request.url).pathname;
  const publicPage=['/','/explore','/films','/films/','/research','/canon'].includes(path)||path.startsWith('/research/')||path.startsWith('/canon/');
  if(request.method!=='GET'||!publicPage||response.status!==200||!response.headers.get('content-type')?.includes('text/html'))return response;
  return new HTMLRewriter().on('nav[aria-label="产品导航"],nav[aria-label="移动导航"]',{element(element){element.append('<a href="/videos" data-video-study-nav>视频精选100</a>',{html:true});}}).transform(response);
 }};
}

// Catalogue-only overlay for a production Worker that already contains the
// video navigation. Pass existing pages through without adding duplicate links.
export function withVideoStudyCatalogue(currentWorker){
 if(typeof currentWorker?.fetch!=='function')throw new TypeError('A current Worker is required');
 const library=createVideoStudyLibrary();
 return {async fetch(request,env,ctx){return library.fetch(request)??currentWorker.fetch(request,env,ctx);}};
}
