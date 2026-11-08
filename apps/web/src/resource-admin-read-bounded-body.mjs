/** Bound bytes before accumulating or decoding; no media/Cloudflare Stream use. */
export async function readBoundedBody(request,limit=8192){
  if(!request.body)return {text:''};
  const reader=request.body.getReader(),chunks=[];let total=0;
  try{
    while(true){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;
      if(total>limit){await reader.cancel();return {error:'BODY_TOO_LARGE'};}chunks.push(value);}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};}catch{return {error:'INVALID_BODY_ENCODING'};}
  }finally{reader.releaseLock();}
}
