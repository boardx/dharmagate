// Bounded cache of the exact, licensed, immutable publisher sources. No user-supplied URLs or writes.
let activeSourceBytes=0;
const MAX_ACTIVE_SOURCE_BYTES=20_000_000; // Volatile public-transfer admission only; never holds a request, binding, stream or promise.
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
async function bytesOf(stream,size){if(!stream||!Number.isInteger(size)||size<1||size>32_000_000)throw Error('SOURCE_BOUND');const reader=stream.getReader(),chunks=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>size){await reader.cancel();throw Error('SOURCE_OVERFLOW')}chunks.push(value)}}finally{reader.releaseLock()}if(length!==size)throw Error('SOURCE_TRUNCATED');const bytes=new Uint8Array(length);let offset=0;for(const b of chunks){bytes.set(b,offset);offset+=b.length}return bytes}
export async function readVerifiedCanonOriginal({row,commit,read,fetchSource=globalThis.fetch,receiptOnly=false}){
 if(commit!=='8ebac86d00719479db5777dc6cd77ba111c3067a'||row?.rightsEligible!==true||!/^[A-Z]{1,2}\d{2,3}n[0-9A-Za-z_-]{1,24}$/.test(row.id)||!new Set(['T','X','J','N','A','B','C','CC','D','F','G','GA','GB','I','K','L','M','P','S','U','ZS','ZW']).has(row.collection)||row.sourcePath!==row.collection+'/'+row.volume+'/'+row.id+'.xml'||!['CC BY-NC-SA 4.0','CC BY 2.5'].includes(row.license)||!/^[a-f0-9]{40}$/.test(row.gitBlob)||!/^[a-f0-9]{64}$/.test(row.rawSha256)||!Number.isInteger(row.sourceBytes)||row.sourceBytes<1||row.sourceBytes>32_000_000)throw Error('SOURCE_ADMISSION');
 if(!new RegExp('^'+row.collection+'[0-9]{2,3}$').test(row.volume)||!row.id.startsWith(row.volume+'n'))throw Error('SOURCE_VOLUME');
 const stoneBy25=row.collection==='I'&&row.volume==='I01'&&/^I01n[0-9]{4}$/.test(row.id)&&Number(row.id.slice(4))>=1&&Number(row.id.slice(4))<=100;
 if((row.license==='CC BY 2.5')!==stoneBy25)throw Error('SOURCE_LICENSE_EXCEPTION');
 if(['LC','TX','Y','YP'].includes(row.collection))throw Error('CATEGORY_B_BLOCKED'); // B supplement is Category A; do not confuse its root letter with rights Category B.
 const key='canon/'+commit+'/original-xml/'+row.id+'.xml';
 if(receiptOnly&&typeof read.head==='function'){const h=await read.head(key);if(h){if(h.size!==row.sourceBytes||h.customMetadata?.sourcesha256!==row.rawSha256||h.customMetadata?.sourcecommit!==commit)throw Error('CACHED_METADATA_MISMATCH');return {fromCache:true,receipt:'cached-metadata-match',size:h.size,sha256:row.rawSha256}}}
 if(activeSourceBytes+row.sourceBytes>MAX_ACTIVE_SOURCE_BYTES)throw Error('SOURCE_BUSY');
 activeSourceBytes+=row.sourceBytes;
 try{
 let object=await read(key),bytes,fromCache=Boolean(object);
 if(object){if(object.size!==row.sourceBytes)throw Error('CACHED_SIZE');bytes=await bytesOf(object.body,row.sourceBytes)}else{
  if(typeof read.put!=='function')throw Error('CANON_STORE_REQUIRED');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25_000);
  try{const response=await fetchSource('https://raw.githubusercontent.com/cbeta-org/xml-p5/'+commit+'/'+row.sourcePath,{redirect:'manual',signal:controller.signal,headers:{Accept:'application/xml'}});if(!response.ok)throw Error('PUBLISHER_UNAVAILABLE');bytes=await bytesOf(response.body,row.sourceBytes)}finally{clearTimeout(timer)}
 }
 const sha256=hex(await crypto.subtle.digest('SHA-256',bytes));if(sha256!==row.rawSha256)throw Error('ORIGINAL_SHA256');
 const prefix=new TextEncoder().encode('blob '+bytes.length+'\0'),blob=new Uint8Array(prefix.length+bytes.length);blob.set(prefix);blob.set(bytes,prefix.length);if(hex(await crypto.subtle.digest('SHA-1',blob))!==row.gitBlob)throw Error('ORIGINAL_GIT_BLOB');
 if(!fromCache)await read.put(key,bytes,{httpMetadata:{contentType:'application/xml;charset=utf-8'},customMetadata:{sourcesha256:sha256,sourcegitblob:row.gitBlob,sourcecommit:commit}});
 return {bytes:receiptOnly?undefined:bytes,fromCache,receipt:fromCache?'cached-content-verified':'publisher-hashes-verified-and-stored',size:bytes.length,sha256};
 }finally{activeSourceBytes-=row.sourceBytes}
}

