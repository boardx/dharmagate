import {createStrictAdminOriginGuard} from './resource-admin-origin-guard.mjs';
import {adminJsonClient} from './resource-admin-json-client.mjs';
import {readBoundedBody} from './resource-admin-read-bounded-body.mjs';
/** Candidate only. Not enabled by production entry.
 * readVerifiedLegacySession must verify the real cookie/signature, expiry and current
 * authoritative user role. No fallback to headers, email allowlists or decoded claims.
 */
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(x);
const purposes = ['download','store','display','derivative','rag','train'];
const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'Referrer-Policy':'no-referrer'};
const json = (value,status=200) => Response.json(value,{status,headers});
const page = body => new Response(`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>资源管理 | 达摩之门</title><style>body{margin:0;background:#f5f3ec;color:#233c33;font:16px/1.6 system-ui}header,main{max-width:1100px;margin:auto;padding:24px}nav{display:flex;flex-wrap:wrap;gap:20px}a{color:#345745}section{background:white;border:1px solid #d8ded5;border-radius:12px;padding:20px;margin:20px 0;overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:left;border-bottom:1px solid #d8ded5}button,select,input{font:inherit;padding:8px;max-width:100%;box-sizing:border-box}label{display:block;margin:12px 0}small{color:#526458}</style><header><a href="/">达摩之门</a><h1>数据资源管理</h1><nav><a href="/zh/admin/resources">资源目录</a><a href="/zh/admin/resources?view=batches">入库批次</a><a href="/zh/admin/resources?view=checks">质量检查</a><a href="/zh/admin/resources?view=audit">审计记录</a><a href="/zh/admin/dashboard">原管理后台</a></nav><p>仅供既有管理员；资源默认私有，许可未知不放行。训练关闭。</p></header><main>${body}</main></html>`,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});

// Pure visual preview. Does not resolve identity, read storage or enable management.
export function resourceAdminVisualPreview(){return page('<section><h2>本地界面预览 · 人工示例</h2><p>管理员认证未接通，本页不能执行管理或入库。以下不是生产数据。</p><table><thead><tr><th>版本</th><th>标题</th><th>状态</th></tr></thead><tbody><tr><td>fixture-v1</td><td>人工文字资源示例</td><td>私有 · 待审核</td></tr></tbody></table></section><section><h2>许可与追溯</h2><p>来源固定版本 → 原始哈希 → 规范化哈希 → 片段定位 → 六用途许可。</p><p>下载/保存/公开/衍生/RAG分别审核；训练关闭。</p></section><section><h2>批次、质检与审计</h2><p>真实记录尚未接入；空记录不代表已入库。</p></section>');}

export function createResourceAdmin({readVerifiedLegacySession, store, csrf, csrfMode='hmac-form',canonicalOrigin,clock=()=>Date.now()}={}) {
  if(!['hmac-form','strict-json'].includes(csrfMode))throw new TypeError('UNKNOWN_CSRF_MODE');
  const strictJson=csrfMode==='strict-json';
  const originGuard=strictJson?createStrictAdminOriginGuard(canonicalOrigin):null;
  return {async fetch(request) {
    const url = new URL(request.url);
    if (!['/zh/admin/resources','/api/admin/resources'].some(p=>url.pathname===p || url.pathname.startsWith(p+'/'))) return null;
    if (!readVerifiedLegacySession || !store || (!strictJson&&!csrf)) return json({error:'ADMIN_INTEGRATION_PENDING'},503);
    let session;
    try {session = await readVerifiedLegacySession(request);} catch {return json({error:'AUTH_UNAVAILABLE'},503);}
    if (!session?.user?.id || !session?.sessionId || !Number.isFinite(Date.parse(session.expires)) || Date.parse(session.expires)<=clock())
      return json({error:'AUTH_REQUIRED'},401);
    if (session.user.role !== 'admin') return json({error:'ADMIN_REQUIRED'},403);
    const api = url.pathname.startsWith('/api/');
    const suffix = api ? url.pathname.slice('/api/admin/resources'.length) : '';
    try {
      if (request.method==='POST') {
        if(strictJson&&!originGuard(request))return json({error:'CSRF_REJECTED'},403);
        if (request.headers.get('origin')!==url.origin || request.headers.get('sec-fetch-site')==='cross-site') return json({error:'CSRF_REJECTED'},403);
        if (!strictJson&&!(request.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded')) return json({error:'FORM_REQUIRED'},415);
        if (Number(request.headers.get('content-length')||0)>8192) return json({error:'BODY_TOO_LARGE'},413);
        const bounded=await readBoundedBody(request);
        if(bounded.error)return json({error:bounded.error},bounded.error==='BODY_TOO_LARGE'?413:400);
        const raw=bounded.text;
        let form;
        if(strictJson){
          let body;try{body=JSON.parse(raw);}catch{return json({error:'INVALID_JSON'},400);}
          // The shipped client emits canonical JSON.stringify output. Reject
          // duplicate keys/ambiguous encodings rather than silently last-wins.
          if(!body||Array.isArray(body)||typeof body!=='object'||Object.values(body).some(v=>typeof v!=='string')||JSON.stringify(body)!==raw)
            return json({error:'INVALID_JSON'},400);
          form=new URLSearchParams(body);
          if(form.has('csrf'))return json({error:'INVALID_FORM'},400);
        }else form=new URLSearchParams(raw);
        if (![...form.keys()].every(k=>['csrf','requestId','purpose','decision','evidenceUrl'].includes(k)) || [...new Set(form.keys())].some(k=>form.getAll(k).length!==1)) return json({error:'INVALID_FORM'},400);
        if (!strictJson&&!await csrf.verify(form.get('csrf'),session)) return json({error:'CSRF_REJECTED'},403);
        const match = /^\/([A-Za-z0-9_-]{1,100})\/rights$/.exec(suffix);
        if (!match) return json({error:'NOT_FOUND'},404);
        const versionId=match[1], requestId=form.get('requestId'), purpose=form.get('purpose'), decision=form.get('decision');
        let evidence;
        try {evidence=new URL(form.get('evidenceUrl'));}catch{return json({error:'INVALID_EVIDENCE'},400);}
        if (!id(requestId)||!purposes.includes(purpose)||!['allow','deny','unknown'].includes(decision)||
            (purpose==='train'&&decision!=='deny')||evidence.protocol!=='https:'||evidence.username||evidence.password)
          return json({error:'INVALID_REVIEW'},400);
        // Store must atomically enforce persistent idempotency and write audit + review;
        // it must never auto-publish a version when a right is allowed.
        const result=await store.reviewRights({versionId,requestId,purpose,decision,evidenceUrl:evidence.href,actorId:session.user.id,at:new Date(clock()).toISOString()});
        if (result==='conflict') return json({error:'IDEMPOTENCY_CONFLICT'},409);
        if (result==='missing') return json({error:'NOT_FOUND'},404);
        if(!['reviewed','already-reviewed'].includes(result))return json({error:'RESOURCE_SERVICE_UNAVAILABLE'},503);
        return json({status:result});
      }
      if (!['GET','HEAD'].includes(request.method)) return json({error:'METHOD_NOT_ALLOWED'},405);
      if (api) {
        if(suffix==='/client.js'&&strictJson)return new Response(request.method==='HEAD'?null:adminJsonClient,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
        if (suffix==='') return json({items:await store.listVersions({limit:50})});
        const match=/^\/([A-Za-z0-9_-]{1,100})$/.exec(suffix);
        if (!match) return json({error:'NOT_FOUND'},404);
        const item=await store.getVersion(match[1]);
        return item ? json({item}) : json({error:'NOT_FOUND'},404);
      }
      if(url.pathname!=='/zh/admin/resources')return json({error:'NOT_FOUND'},404);
      const selected=url.searchParams.get('id');
      if(selected){
        if(!id(selected))return json({error:'INVALID_ID'},400);
        const item=await store.getVersion(selected);
        if(!item)return json({error:'NOT_FOUND'},404);
        const token=strictJson?'':await csrf.issue(session);
        const requestId=crypto.randomUUID();
        const document=page(`<section><h2>${esc(item.title)}</h2><p>版本：${esc(item.id)} · ${esc(item.visibility)}</p><p>来源：${esc(item.sourceUrl)}<br>固定版本：${esc(item.contentVersion)}<br>原始 SHA256：${esc(item.rawSha256)}<br>规范化 SHA256：${esc(item.normalizedSha256)}</p><h3>六用途许可</h3><ul>${purposes.map(p=>`<li>${p}：${esc(item.rights?.[p]||'unknown')}</li>`).join('')}</ul><h3>审核许可（不自动公开）</h3><form ${strictJson?'data-dg-admin-json':''} method="post" action="/api/admin/resources/${esc(item.id)}/rights"><input type="hidden" name="csrf" value="${esc(token)}"><input type="hidden" name="requestId" value="${esc(requestId)}"><label>用途<select name="purpose">${purposes.map(p=>`<option>${p}</option>`).join('')}</select></label><label>结论<select name="decision"><option>unknown</option><option>deny</option><option>allow</option></select></label><label>许可证据 HTTPS URL<input required type="url" name="evidenceUrl"></label><button>保存审核记录</button><p role="status" aria-live="polite"></p></form></section>`);
        if(!strictJson)return document;
        const content=(await document.text()).replace('</main>','</main><script defer src="/api/admin/resources/client.js"></script>');
        const documentHeaders=new Headers(document.headers);
        documentHeaders.set('Content-Security-Policy',headers['Content-Security-Policy']+"; script-src 'self'; connect-src 'self'");
        return new Response(request.method==='HEAD'?null:content,{headers:documentHeaders});
      }
      const view=url.searchParams.get('view')||'catalog';
      const methods={catalog:'listVersions',batches:'listBatches',checks:'listChecks',audit:'listAudit'};
      if(!methods[view])return json({error:'INVALID_VIEW'},400);
      const rows=await store[methods[view]]({limit:50});
      return page(`<section><h2>${esc({catalog:'资源目录',batches:'入库批次',checks:'质量检查',audit:'审计记录'}[view])}</h2>${rows.length?`<table><thead><tr><th>标识</th><th>摘要</th><th>状态/动作</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${view==='catalog'?`<a href="?id=${encodeURIComponent(r.id)}">${esc(r.id)}</a>`:esc(r.id)}</td><td>${esc(r.title||r.safeSummary||r.resourceId||r.sourceId)}</td><td>${esc(r.visibility||r.status||r.result||r.action)}</td></tr>`).join('')}</tbody></table>`:'<p>尚无已接入记录。空目录不代表已入库。</p>'}</section>`);
    } catch { return json({error:'RESOURCE_SERVICE_UNAVAILABLE'},503); }
  }};
}
