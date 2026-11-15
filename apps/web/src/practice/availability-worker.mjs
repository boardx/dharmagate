import{availableRecordingDescription}from'./content.mjs';
export const LEGACY_AVAILABILITY_PARAGRAPH='当前可试听颂钵敲击、颂钵摩擦与木鱼实录。每项均展示原始作者和授权来源。图像为本站原创器物示意插画，不是录音现场照片。';
export const CURRENT_AVAILABILITY_PARAGRAPH=availableRecordingDescription()+'每项均展示原始作者和授权来源。图像为本站原创器物示意插画，不是录音现场照片。';
const paths=new Set(['/practice','/practice/','/practice/timer','/practice/sounds','/practice/history']);
/** Replace one exact outdated site-authored paragraph; never re-render legacy content/media. */
export function createPracticeAvailabilityWorker(current){
 if(typeof current?.fetch!=='function')throw Error('RETAINED_PRACTICE_WORKER_REQUIRED');
 return{async fetch(request,env,ctx){const eligible=request.method==='GET'&&paths.has(new URL(request.url).pathname);const response=await current.fetch(request,env,ctx);if(!eligible||response.status!==200||!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||'')||response.headers.has('content-disposition'))return response;
 let buffer=null;const rewriter=new HTMLRewriter().on('#learning-intro p',{element(){buffer=''},text(chunk){if(buffer===null)return;const combined=buffer+chunk.text;if(!LEGACY_AVAILABILITY_PARAGRAPH.startsWith(combined)){if(buffer)chunk.before(buffer,{html:true});buffer=null;return}buffer=combined;if(!chunk.lastInTextNode){chunk.remove();return}chunk.replace(buffer===LEGACY_AVAILABILITY_PARAGRAPH?CURRENT_AVAILABILITY_PARAGRAPH:buffer,{html:true});buffer=null;}});
 const headers=new Headers(response.headers);for(const h of['content-length','content-encoding','etag','content-md5','digest','content-digest','repr-digest','last-modified'])headers.delete(h);return rewriter.transform(new Response(response.body,{status:response.status,statusText:response.statusText,headers}));
 }};
}
