/** Read-only text search/reading candidate. No embeddings, AI calls or writes.
 * Every response rechecks current publication and display permission in SQL.
 */
const gate = `v.visibility='published'
 AND b.status='complete' AND julianday(s.reviewed_at) IS NOT NULL
 AND EXISTS(SELECT 1 FROM dg_resource_rights r WHERE r.version_id=v.id AND r.purpose='display'
   AND r.decision='allow' AND r.reviewer_id<>'' AND julianday(r.reviewed_at) IS NOT NULL AND r.evidence_url LIKE 'https://%')
 AND EXISTS(SELECT 1 FROM dg_resource_checks c WHERE c.version_id=v.id AND c.check_kind='sha256' AND c.result='pass')
 AND NOT EXISTS(SELECT 1 FROM dg_resource_checks c WHERE (c.version_id=v.id OR (c.version_id IS NULL AND c.batch_id=v.batch_id)) AND c.result='fail')
 AND EXISTS(SELECT 1 FROM dg_resource_audit a JOIN dg_resource_rights r ON r.version_id=v.id AND r.purpose='display'
   WHERE a.resource_id=v.id AND a.action='publication-approved' AND a.actor_id<>'' AND a.payload_sha256=v.normalized_sha256 AND a.rights_revision=r.revision
   AND julianday(a.occurred_at)>=julianday(r.reviewed_at) AND julianday(a.occurred_at)>=julianday(s.reviewed_at))`;
const fields=`v.id AS versionId,w.title,w.language,s.source_url AS sourceUrl,s.pinned_version AS sourcePinned,
 v.source_ref AS sourceRef,v.content_version AS contentVersion,v.raw_sha256 AS rawSha256,
 v.normalized_sha256 AS normalizedSha256,f.id AS fragmentId,f.locator,f.ordinal,f.body,f.sha256 AS fragmentSha256`;
const join=`FROM dg_resource_versions v JOIN dg_resource_works w ON w.id=v.work_id
 JOIN dg_resource_sources s ON s.id=v.source_id JOIN dg_ingest_batches b ON b.id=v.batch_id
 JOIN dg_resource_fragments f ON f.version_id=v.id AND f.kind='normalized'`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const sha=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const json=(body,status=200)=>Response.json(body,{status,headers});
function sourceHref(value){try{if(typeof value!=='string'||/[\u0000-\u0020\u007f]/.test(value))return null;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function html(title,body){return new Response(`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | 达摩之门</title><style>body{margin:0;background:#f5f3ec;color:#233c33;font:17px/1.8 system-ui}header,main{max-width:920px;margin:auto;padding:24px}nav{display:flex;flex-wrap:wrap;gap:20px}a{color:#345745;overflow-wrap:anywhere}article,section{background:white;border:1px solid #d8ded5;border-radius:10px;padding:24px;margin:20px 0}p{white-space:pre-wrap;overflow-wrap:anywhere}input,button{font:inherit;padding:10px;max-width:100%;box-sizing:border-box}input{width:70%}small{color:#526458}code{overflow-wrap:anywhere}dt{font-weight:600}dd{margin:0 0 14px;overflow-wrap:anywhere}:target{outline:2px solid #a58c52;outline-offset:8px}@media(max-width:600px){header,main{padding:16px}article,section{padding:18px}input{width:100%;margin-bottom:8px}}</style><header><nav><a href="/">达摩之门</a><a href="/texts">文本目录与检索</a><a href="/zh">旧应用</a><a href="/whitepaper">白皮书</a></nav><p><small>普通关键词检索与原文阅读。没有生成式AI、嵌入或训练。</small></p></header><main>${body}</main></html>`,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});}
async function verifyRows(rows){
 if(rows.length>4096)return false;
 let size=0;
 for(const row of rows){
  if(!id(row.versionId)||!id(row.fragmentId)||typeof row.body!=='string'||!/^([a-f0-9]{64})$/.test(row.fragmentSha256||''))return false;
  const bytes=new TextEncoder().encode(row.body).length;size+=bytes;
  if(bytes>32768||size>524288||await sha(row.body)!==row.fragmentSha256||!sourceHref(row.sourceUrl))return false;
 }
 return true;
}
function publicItem(row){const {body,...metadata}=row;return {...metadata,text:body};}
async function readingUnits(rows){
 const text=rows.map(r=>r.body).join('');
 // The pilot's normalized JSONL preserves original segmentKey/text. Reassemble
 // storage chunks before parsing: an 8Ki-character chunk can split a JSON line.
 if(text.trimStart().startsWith('{"segmentKey":')){
  let parsed;try{parsed=text.trimEnd().split('\n').map(line=>JSON.parse(line));}catch{return null;}
  if(!parsed.length||parsed.some(x=>!x||typeof x.text!=='string'||typeof x.segmentKey!=='string'||!/^[-A-Za-z0-9_:.\/]{1,200}$/.test(x.segmentKey))||new Set(parsed.map(x=>x.segmentKey)).size!==parsed.length)return null;
  return Promise.all(parsed.map(async x=>({...rows[0],body:x.text,fragmentId:null,segmentKey:x.segmentKey,locator:'segment:'+x.segmentKey,fragmentSha256:await sha(x.text)})));
 }
 return rows;
}
const anchor=r=>r.segmentKey?'s-'+r.segmentKey:'f-'+r.fragmentId;
export function createPublicReading({db,base='/texts'}={}){
 if(!db?.prepare||base!=='/texts')throw new TypeError('READ_ONLY_D1_BINDING_REQUIRED');
 return {async fetch(request){
  const url=new URL(request.url),api=url.pathname.startsWith('/api/texts');
  if(![base,base+'/','/api/texts/search'].includes(url.pathname)&&!url.pathname.startsWith(base+'/')&&!url.pathname.startsWith('/api/texts/read/')&&!url.pathname.startsWith('/api/texts/download/'))return null;
  if(!['GET','HEAD'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
  // The schema's download purpose authorizes acquisition, not automatically an
  // end-user original/export endpoint. There is no such reviewed grant here.
  if(/^\/texts\/[^/]+\/download$/.test(url.pathname)||url.pathname.startsWith('/api/texts/download/')||url.searchParams.has('download')||['raw','zip'].includes(url.searchParams.get('format')))
    return json({error:'END_USER_DOWNLOAD_NOT_APPROVED'},403);
  const reading=api?/^\/api\/texts\/read\/([^/]+)$/.exec(url.pathname):/^\/texts\/([^/]+)$/.exec(url.pathname);
  try{
   let response;
   if(reading){
    let version;try{version=decodeURIComponent(reading[1]);}catch{return json({error:'INVALID_ID'},400);}
    if(!id(version))return json({error:'INVALID_ID'},400);
    const result=await db.prepare(`SELECT ${fields} ${join} WHERE v.id=? AND ${gate} ORDER BY f.ordinal LIMIT 4097`).bind(version).all();
    const rows=result.results||[];
    if(!rows.length)return json({error:'NOT_FOUND'},404); // Private/revoked/missing indistinguishable.
    if(!await verifyRows(rows)||await sha(rows.map(r=>r.body).join(''))!==rows[0].normalizedSha256)return json({error:'CONTENT_INTEGRITY_UNAVAILABLE'},503);
    const units=await readingUnits(rows);
    if(!units)return json({error:'CONTENT_INTEGRITY_UNAVAILABLE'},503);
    if(api)response=json({version:rows[0].versionId,fragments:units.map(publicItem),aiUse:'disabled'});
    else{
     const first=rows[0];
     response=html(first.title,`<h1>${esc(first.title)}</h1><section><h2>出处与版本</h2><dl><dt>来源</dt><dd><a rel="noreferrer" href="${esc(sourceHref(first.sourceUrl))}">${esc(first.sourceUrl)}</a></dd><dt>来源固定版本</dt><dd><code>${esc(first.sourcePinned)}</code></dd><dt>原文定位</dt><dd>${esc(first.sourceRef)}</dd><dt>内容版本</dt><dd>${esc(first.contentVersion)}</dd></dl><details><summary>完整性哈希</summary><p>原始SHA256：<code>${esc(first.rawSha256)}</code><br>规范化SHA256：<code>${esc(first.normalizedSha256)}</code></p></details></section><article>${units.map(r=>`<section id="${esc(anchor(r))}"><small>${esc(r.locator)} · <a href="#${encodeURIComponent(anchor(r))}">引用此片段</a></small><p lang="${esc(r.language)}">${esc(r.body)}</p><details><summary>片段完整性</summary><code>${esc(r.fragmentSha256)}</code></details></section>`).join('')}</article>`);
    }
   }else if([base,base+'/','/api/texts/search'].includes(url.pathname)){
    const q=(url.searchParams.get('q')||'').trim();
    if(q.length>120)return json({error:'QUERY_TOO_LONG'},400);
    // Pilot scan is bounded at 512KiB/4096 chunks. Query text is NEVER inserted
    // into SQL; Unicode-aware literal matching happens over verified segments.
    const rawRows=q.length>=2?(await db.prepare(`SELECT ${fields} ${join} WHERE ${gate} ORDER BY v.id,f.ordinal LIMIT 4097`).all()).results||[]:[];
    if(!await verifyRows(rawRows))return json({error:'CONTENT_INTEGRITY_UNAVAILABLE'},503);
    let rows=[];
    for(const versionId of new Set(rawRows.map(r=>r.versionId))){
     const group=rawRows.filter(r=>r.versionId===versionId);
     if(await sha(group.map(r=>r.body).join(''))!==group[0].normalizedSha256)return json({error:'CONTENT_INTEGRITY_UNAVAILABLE'},503);
     const units=await readingUnits(group);if(!units)return json({error:'CONTENT_INTEGRITY_UNAVAILABLE'},503);
     rows.push(...units.filter(r=>r.body.toLowerCase().includes(q.toLowerCase())));
    }
    rows=rows.slice(0,20);
    if(api)response=json({query:q,items:rows.map(r=>({...publicItem(r),text:r.body.slice(0,240),href:`${base}/${encodeURIComponent(r.versionId)}#${encodeURIComponent(anchor(r))}`})),aiUse:'disabled'});
    else response=html('文本检索',`<h1>有出处的文本阅读</h1><form method="get" action="${base}"><label>关键词（2–120字符）<br><input name="q" maxlength="120" value="${esc(q)}"></label> <button>检索</button></form><p>仅显示已审核公开、当前允许展示且质检通过的版本。撤权后不再提供内容。</p>${rows.length?rows.map(r=>`<section><h2><a href="${base}/${encodeURIComponent(r.versionId)}#${encodeURIComponent(anchor(r))}">${esc(r.title)}</a></h2><p>${esc(r.body.slice(0,240))}</p><small>${esc(r.language)} · ${esc(r.locator)} · 来源版本 ${esc(r.sourcePinned)}</small></section>`).join(''):'<section><p>没有可显示的匹配结果。未审核或私有资料不会出现在这里。</p></section>'}`);
   }else return json({error:'NOT_FOUND'},404);
   return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
  }catch{return json({error:'READING_UNAVAILABLE'},503);}
 }};
}

export const publicGateContract={requires:['published','display-allow-with-review','reviewed-source','complete-batch','sha256-pass','no-failed-check','publication-approved-audit'],writes:false,ai:false};
