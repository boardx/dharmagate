import {createHash} from 'node:crypto';
/** Independent read-only resolver for a reviewed, hash-pinned deployed contract.
 * No legacy helper execution, signature forging, role changes or cookie writes.
 */
const reviewed={bundleSha256:'398ff64e94eb60eb83a773a552c57f53c245bc58573ea4d0cbb1f7a7c94e1881',readerSha256:'51922a6d441c1e32de27ec4421ff371233eef366506c508cebf3cb9e8822e681',generatorSha256:'dce6ce2d0acd69c93f7dc95b1ab69b9b53fe49cee2d601a515d8c5645333df81'};
export function createLegacyDbSessionResolver({db,contract,clock=()=>Date.now()}={}){
  const canonical=JSON.stringify(Object.fromEntries(['bundleSha256','cookieName','readerSha256','generatorSha256','expiryUnit','status','generatedToken','storedAdminRole'].map(k=>[k,contract?.[k]])));
  if(createHash('sha256').update(canonical).digest('hex')!=='28b9f04ff41b1e9397d462401dd04b57d4ffa27dbbe5bd4b35400646c5e2c304')throw new TypeError('VERIFIED_LEGACY_CONTRACT_REQUIRED');
  if(!db?.prepare||!contract||!Object.entries(reviewed).every(([k,v])=>contract[k]===v)||
     contract.status!=='cookie-generator-and-reader-reviewed'||contract.expiryUnit!=='milliseconds'||
     contract.generatedToken!=='crypto.randomUUID'||contract.storedAdminRole!=='admin'||
     !/^[A-Za-z][A-Za-z0-9_.-]{1,79}$/.test(contract.cookieName||'')) throw new TypeError('VERIFIED_LEGACY_CONTRACT_REQUIRED');
  return async request=>{
    const raw=request.headers.get('cookie');
    if(!raw||raw.length>8192)return null;
    let token=null,count=0;
    try{
      for(const pair of raw.split(';')){
        const [key,...parts]=pair.trim().split('=');
        if(!key)continue;
        const value=decodeURIComponent(parts.join('='));
        if(key===contract.cookieName){count++;token=value;}
      }
    }catch{return null;}
    // The old reader is last-wins. Reject ambiguity rather than picking a token
    // from competing path/domain cookies. Only UUID-v4 values are generated.
    if(count!==1||!token||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))return null;
    const row=await db.prepare('SELECT s.userId AS id,s.expires AS expiresMs,u.role AS role FROM session s JOIN user u ON u.id=s.userId WHERE s.sessionToken=? LIMIT 1').bind(token).first();
    if(!row?.id||!Number.isSafeInteger(row.expiresMs)||row.expiresMs<=clock())return null;
    // Use a digest as an internal CSRF/session binding; do not return raw token.
    const sessionId=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
    return {sessionId,user:{id:row.id,role:row.role??'user'},expires:new Date(row.expiresMs).toISOString()};
  };
}
