/** Server-only HMAC service. No default key; key is never serialized to HTML. */
export async function createAdminCsrf(keyBytes,{clock=()=>Date.now(),ttlMs=15*60*1000}={}) {
  if(!(keyBytes instanceof Uint8Array)||keyBytes.length<32)throw new TypeError('SERVER_KEY_REQUIRED');
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const enc=new TextEncoder();
  const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const payload=(expiry,nonce,session)=>`${expiry}.${nonce}.${session.sessionId}.${session.user.id}`;
  return {
    async issue(session){
      const expiry=clock()+ttlMs,nonce=crypto.randomUUID();
      return `${expiry}.${nonce}.${hex(await crypto.subtle.sign('HMAC',key,enc.encode(payload(expiry,nonce,session))))}`;
    },
    async verify(token,session){
      if(typeof token!=='string'||token.length>200)return false;
      const m=/^(\d+)\.([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(token);
      if(!m)return false;
      const expiry=Number(m[1]);
      if(expiry<=clock()||expiry>clock()+ttlMs)return false;
      const bytes=Uint8Array.from(m[3].match(/../g),x=>parseInt(x,16));
      return crypto.subtle.verify('HMAC',key,bytes,enc.encode(payload(expiry,m[2],session)));
    }
  };
}
