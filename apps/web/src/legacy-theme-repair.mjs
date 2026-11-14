/** Repair only the fingerprinted, previously deployed public Next theme bootstrap.
 * This does not parse application/RSC data, infer a session, or relax CSP.
 */
export const LEGACY_THEME_SHA256='dab1dc503d75cb5a34507ee338a4536a68d5ce9ccddd7fba68c74d751ff3f2ae';
const PREFIX='((m,l,A,g,v,b,k,_)=>{let T=document.documentElement,O=';
const BROKEN='if(t(R,"k2"),u(R,"k2"),g)';
const MAX_BYTES=548;
const BLOCKING_HEADERS=['rsc','next-router-state-tree','next-router-prefetch','next-router-segment-prefetch','next-url','purpose','sec-purpose'];
export function isLegacyThemePublicDocument(input){
 let url;try{url=new URL(String(input),'https://dharmagate.us')}catch{return false}
 if(url.origin!=='https://dharmagate.us'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))return false;
 const path=url.pathname==='/'?'/':url.pathname.replace(/\/$/,'');
 return ['/','/zh','/en','/articles','/zh/articles','/en/articles'].includes(path)||/^\/(?:zh\/|en\/)?articles\/[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(path);
}
export function inlineScriptAllowed(policy,nonce){
 if(!policy)return true;
 if(policy.includes(','))return false;
 const directives=new Map();
 for(const part of policy.split(';')){const[name,...values]=part.trim().split(/\s+/);if(!name)continue;const key=name.toLowerCase();if(directives.has(key))return false;directives.set(key,values)}
 const sources=directives.get('script-src-elem')??directives.get('script-src')??directives.get('default-src');
 if(!sources)return true;
 if(sources.includes("'none'"))return false;
 if(nonce&&/^[A-Za-z0-9+/_=-]{1,256}$/.test(nonce)&&sources.includes("'nonce-"+nonce+"'"))return true;
 return sources.includes("'unsafe-inline'")&&!sources.some(x=>/^'(?:nonce-|sha(?:256|384|512)-|strict-dynamic')/.test(x));
}
export async function repairKnownThemeBootstrap(source){
 if(typeof source!=='string'||!source.startsWith(PREFIX)||new TextEncoder().encode(source).length!==MAX_BYTES)return null;
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(digest!==LEGACY_THEME_SHA256||source.indexOf(BROKEN)!==source.lastIndexOf(BROKEN)||!source.includes(BROKEN))return null;
 return source.replace(BROKEN,'if(g)');
}
export function createLegacyThemeRepairWorker(current){
 if(typeof current?.fetch!=='function')throw Error('LEGACY_WORKER_REQUIRED');
 return {async fetch(request,env,ctx){
  // Immutable request decision: the retained framework may rewrite its own URL.
  const eligible=request.method==='GET'&&isLegacyThemePublicDocument(request.url)&&!BLOCKING_HEADERS.some(name=>request.headers.has(name));
  const response=await current.fetch(request,env,ctx);
  if(!eligible||response.status!==200||!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||'')||response.headers.has('content-disposition'))return response;
  const policy=response.headers.get('content-security-policy')||'';
  let metaSeen=false,state=null;
  const rewriter=new HTMLRewriter().on('meta[http-equiv]',{element(e){if(e.getAttribute('http-equiv')?.toLowerCase()==='content-security-policy')metaSeen=true}}).on('script',{
   element(e){
    const type=(e.getAttribute('type')||'').toLowerCase();
    state=!metaSeen&&!e.hasAttribute('src')&&['','text/javascript','application/javascript'].includes(type)&&inlineScriptAllowed(policy,e.getAttribute('nonce'))?{buffer:'',candidate:true}:null;
   },
   async text(chunk){
    if(!state?.candidate)return;
    // Ignore non-theme scripts at their first prefix, including __next_f RSC.
    const needed=Math.max(0,PREFIX.length-state.buffer.length);
    const head=(state.buffer+chunk.text.slice(0,needed)).slice(0,PREFIX.length);
    if(!PREFIX.startsWith(head)){
     if(state.buffer)chunk.before(state.buffer,{html:true});
     state=null;return;
    }
    if(state.buffer.length+chunk.text.length>MAX_BYTES){
     if(state.buffer)chunk.before(state.buffer,{html:true});
     state=null;return;
    }
    state.buffer+=chunk.text;
    if(!chunk.lastInTextNode){chunk.remove();return}
    const original=state.buffer,repaired=await repairKnownThemeBootstrap(original);
    chunk.replace(repaired??original,{html:true});state=null;
   }
  });
  const headers=new Headers(response.headers);
  for(const key of ['content-length','content-encoding','etag','content-md5','digest','content-digest','repr-digest','last-modified'])headers.delete(key);
  return rewriter.transform(new Response(response.body,{status:response.status,statusText:response.statusText,headers}));
 }};
}
