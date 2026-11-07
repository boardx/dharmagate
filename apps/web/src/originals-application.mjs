import {renderOriginalsPage,ORIGINALS_CLIENT,ORIGINALS_CSS} from './originals-viewer.mjs';

const BASE='/canon/originals';
const SOURCE_IDS=['nijl-200019041','kyoto-rb00009556'];
const common={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
function error(request,status,code,message){return new Response(request.method==='HEAD'?null:JSON.stringify({error:code,message}),{status,headers:{...common,'content-type':'application/json;charset=utf-8'}})}
function validChecksum(object,sha){
 const checksum=object?.checksums?.sha256;
 if(checksum!=null){let b;if(checksum instanceof ArrayBuffer)b=new Uint8Array(checksum);else if(ArrayBuffer.isView(checksum))b=new Uint8Array(checksum.buffer,checksum.byteOffset,checksum.byteLength);else return false;if(b.length!==32||[...b].map(x=>x.toString(16).padStart(2,'0')).join('')!==sha)return false}
 if(object?.customMetadata&&Object.hasOwn(object.customMetadata,'sha256')&&object.customMetadata.sha256!==sha)return false;
 return true;
}
function validObject(object,page){return !!object&&object.key===page.storageKey&&object.size===page.bytes&&validChecksum(object,page.sha256)&&typeof object.etag==='string'&&object.etag.length>0&&object.etag.length<=512&&!/[\x00-\x20\x7f"]/.test(object.etag)&&object.httpEtag==='"'+object.etag+'"'}
function rangeOf(value,size){
 if(!value||!/^bytes=/i.test(value)||value.includes(','))return null;
 const m=value.match(/^bytes=(\d*)-(\d*)$/i);if(!m||!m[1]&&!m[2])return false;
 let start,end;if(!m[1]){const n=Number(m[2]);if(!Number.isSafeInteger(n)||n<=0)return false;start=Math.max(0,size-n);end=size-1}else{start=Number(m[1]);end=m[2]?Number(m[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return false;end=Math.min(end,size-1)}return {start,end};
}
async function discard(object){try{await object?.body?.cancel?.()}catch{}}
async function imageResponse(request,page,env){
 const bucket=env?.CANON_STORAGE;
 if(!bucket||typeof bucket.head!=='function'||typeof bucket.get!=='function')return error(request,503,'CANON_STORAGE_UNAVAILABLE','古本影像存储暂未就绪，请稍后重试。');
 let head;try{head=await bucket.head(page.storageKey)}catch{return error(request,503,'ORIGINAL_READ_FAILED','古本影像暂时无法读取，请稍后重试。')}
 if(!head)return error(request,503,'ORIGINAL_OBJECT_UNAVAILABLE','该页影像尚未准备好，请稍后重试。');
 if(!validObject(head,page))return error(request,503,'ORIGINAL_METADATA_MISMATCH','该页影像校验未通过，暂不展示。');
 const headers={...common,'content-type':'image/jpeg','content-length':String(page.bytes),'accept-ranges':'bytes','cache-control':'public, max-age=31536000, immutable, no-transform',etag:head.httpEtag};
 if(request.headers.get('if-none-match')?.split(',').some(x=>x.trim()==='*'||x.trim().replace(/^W\//,'')===head.httpEtag)){delete headers['content-length'];return new Response(null,{status:304,headers})}
 // Range applies to GET. A nonmatching/weak/date If-Range conservatively sends the whole image.
 const ifRange=request.headers.get('if-range'),range=request.method==='GET'&&(!ifRange||ifRange===head.httpEtag)?rangeOf(request.headers.get('range'),page.bytes):null;
 if(range===false)return new Response(null,{status:416,headers:{...headers,'content-range':'bytes */'+page.bytes,'content-length':'0'}});
 if(request.method==='HEAD')return new Response(null,{headers});
 const options={onlyIf:{etagMatches:head.etag}};if(range)options.range={offset:range.start,length:range.end-range.start+1};
 let object;try{object=await bucket.get(page.storageKey,options)}catch{return error(request,503,'ORIGINAL_READ_FAILED','古本影像暂时无法读取，请稍后重试。')}
 if(!object?.body||typeof object.body.getReader!=='function'||!validObject(object,page)||object.etag!==head.etag||(head.version&&head.version!==object.version)||(range&&(object.range?.offset!==range.start||object.range?.length!==range.end-range.start+1))||(!range&&object.range&&(object.range.offset!==0||object.range.length!==page.bytes))){await discard(object);return error(request,503,'ORIGINAL_OBJECT_CHANGED','该页影像状态已变化，请重新尝试。')}
 if(range)return new Response(object.body,{status:206,headers:{...headers,'content-length':String(range.end-range.start+1),'content-range':`bytes ${range.start}-${range.end}/${page.bytes}`}});
 return new Response(object.body,{headers});
}
/** Only explicitly supplied audited catalogue entries are served. No object listing or caller-selected keys. */
export function createOriginalsApplication({books,renderPage=renderOriginalsPage,client=ORIGINALS_CLIENT,css=ORIGINALS_CSS}={}){
 if(!Array.isArray(books)||books.length!==2)throw Error('TWO_AUDITED_ORIGINAL_SOURCES_REQUIRED');
 books=structuredClone(books);
 const byId=new Map(),images=new Map();
 for(const book of books){if(!SOURCE_IDS.includes(book.id)||byId.has(book.id)||!Array.isArray(book.frames)||!book.frames.length||!book.title||!book.attribution||!book.licenseLabel||!/^https:\/\//.test(book.licenseUrl||'')||!book.processing||!/^https:\/\//.test(book.sourceUrl||'')||!/^[a-zA-Z0-9_-]+$/.test(book.id))throw Error('INVALID_AUDITED_ORIGINAL_BOOK');byId.set(book.id,book);
  for(const page of book.frames){if(!/^[a-f0-9]{64}$/.test(page.sha256)||!Number.isSafeInteger(page.bytes)||page.bytes<=0||!Number.isSafeInteger(page.width)||page.width<=0||!Number.isSafeInteger(page.height)||page.height<=0||page.storageKey!=='canon-originals/v1/'+page.sha256+'.jpg'||page.imageUrl!==BASE+'/image/'+page.sha256+'.jpg')throw Error('INVALID_AUDITED_ORIGINAL_PAGE');const path=BASE+'/image/'+page.sha256+'.jpg',prior=images.get(path);if(prior&&(prior.bytes!==page.bytes||prior.storageKey!==page.storageKey))throw Error('CONFLICTING_ORIGINAL_IMAGE');images.set(path,page)}
 }
 const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value};freeze(books);
 return {async fetch(request,env={}){
  const url=new URL(request.url),path=url.pathname;if(path!==BASE&&!path.startsWith(BASE+'/'))return null;
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...common,allow:'GET, HEAD'}});
  if(path.startsWith(BASE+'/image/')){const page=images.get(path);return page?imageResponse(request,page,env):error(request,404,'ORIGINAL_NOT_FOUND','未找到此影像。')}
  if(path===BASE+'/client.js'||path===BASE+'/style.css')return new Response(request.method==='HEAD'?null:path.endsWith('.js')?client:css,{headers:{...common,'content-type':path.endsWith('.js')?'text/javascript;charset=utf-8':'text/css;charset=utf-8'}});
  let book=null,page=null;if(path!==BASE&&path!==BASE+'/'){const id=path.slice(BASE.length+1);book=byId.get(id);if(!book)return error(request,404,'ORIGINAL_BOOK_NOT_FOUND','未找到此古本。');const raw=url.searchParams.get('page')??'1';if(!/^[1-9]\d*$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)>book.frames.length)return error(request,400,'INVALID_ORIGINAL_PAGE','请选择有效的影像页码。');page=Number(raw)}
  const nonce=crypto.randomUUID().replaceAll('-',''),html=renderPage({books,book,page,error:null,nonce,basePath:BASE,clientUrl:BASE+'/client.js',cssUrl:BASE+'/style.css'});
  return new Response(request.method==='HEAD'?null:html,{headers:{...common,'content-type':'text/html;charset=utf-8','content-security-policy':`default-src 'none'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`}});
 }};
}
