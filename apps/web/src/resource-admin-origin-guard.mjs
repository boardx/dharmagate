/** Independent local CSRF alternative. Does NOT authenticate or authorize anyone.
 * Modern same-origin JSON clients only; no permissive CORS or form fallback.
 * Not selected by the deployed or local admin handler.
 */
export function createStrictAdminOriginGuard(expectedOrigin){
  const configured=new URL(expectedOrigin);
  if(configured.protocol!=='https:'||configured.origin!==expectedOrigin||configured.username||configured.password)
    throw new TypeError('CANONICAL_HTTPS_ORIGIN_REQUIRED');
  return request=>{
    if(request.method!=='POST')return false;
    if(new URL(request.url).origin!==configured.origin)return false;
    if(request.headers.get('origin')!==configured.origin)return false;
    if(request.headers.get('sec-fetch-site')!=='same-origin')return false;
    if(request.headers.get('x-dharmagate-admin-request')!=='1')return false;
    const type=(request.headers.get('content-type')||'').trim().toLowerCase();
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/.test(type))return false;
    return true;
  };
}
