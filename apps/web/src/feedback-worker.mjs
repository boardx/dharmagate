import {feedbackScript,adminHtml} from './feedback-ui.mjs';
const states=new Set(['pending','rejected','syncing','sync_failed','published']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
/** resolveAdmin MUST verify the existing server session and authoritative admin membership. */
export function createFeedbackWorker(currentWorker,{store,github,resolveAdmin,rewriteHtml}) {
 if(!store||!github||typeof resolveAdmin!=='function')throw new TypeError('Feedback store, GitHub publisher and verified admin resolver required');
 return {async fetch(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/feedback-widget.js')return new Response(request.method==='HEAD'?null:feedbackScript,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 if(path==='/admin/feedback'||path==='/api/feedback'||path.startsWith('/api/feedback/')){
 try{
 const submit=path==='/api/feedback'&&request.method==='POST';
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))return json({error:'请求来源无效'},403);
 let actor;
 if(!submit){actor=await resolveAdmin(request,env);if(!actor?.id)return json({error:'需要管理员权限'},403);}
 if(path==='/admin/feedback'&&request.method==='GET')return new Response(adminHtml,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"}});
 if(path==='/api/feedback'&&request.method==='GET'){
 const status=url.searchParams.get('status')||null,offset=Number(url.searchParams.get('offset')||0);
 if((status&&!states.has(status))||!Number.isSafeInteger(offset)||offset<0||offset>100000)return json({error:'筛选参数无效'},400);
 const rows=await store.list(status,offset);return json({items:rows.slice(0,50),hasMore:rows.length>50});}
 if(request.method!=='POST')return json({error:'不支持的操作'},405);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'需要 JSON 请求'},415);
 const reader=request.body?.getReader();let bytes=0,chunks=[];
 if(reader){for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>24000){await reader.cancel();return json({error:'反馈过长'},413);}chunks.push(value);}}
 let body;try{body=JSON.parse(await new Blob(chunks).text());}catch{return json({error:'请求格式无效'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'请求格式无效'},400);
 if(submit){
 const {title,description,category,page_path}=body;
 if(typeof title!=='string'||!title.trim()||title.length>160||typeof description!=='string'||!description.trim()||description.length>5000||!['bug','idea','content','other'].includes(category)||typeof page_path!=='string'||!page_path.startsWith('/')||page_path.startsWith('//')||page_path.length>1000||/[?#\r\n]/.test(page_path))return json({error:'请填写有效的标题、说明和页面路径'},400);
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
 const bucket=new Date().toISOString().slice(0,13)+':'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 if(!await store.allow(bucket))return json({error:'提交过于频繁，请稍后重试'},429);
 const id=crypto.randomUUID();await store.insert({id,title:title.trim(),description:description.trim(),category,page_path,created_at:new Date().toISOString()});return json({id,status:'pending'},201);
 }
 const match=path.match(/^\/api\/feedback\/([0-9a-f-]{36})\/(approve|reject)$/);
 if(!match)return json({error:'未找到操作'},404);
 const [,id,action]=match,row=await store.get(id);if(!row)return json({error:'未找到反馈'},404);
 if(action==='reject'){
 if(body.note!==undefined&&(typeof body.note!=='string'||body.note.length>1000))return json({error:'拒绝原因过长'},400);
 return await store.reject(id,actor.id,body.note||'')?json({status:'rejected'}):json({error:'反馈状态已变化'},409);}
 if(row.status==='published')return json({status:row.status,issue_url:row.issue_url});
 if(!await store.claim(id,actor.id))return json({error:'反馈正在同步或已处理'},409);
 try{const issue=await github.publish(row);await store.published(id,issue);return json({status:'published',issue_url:issue.html_url});}
 catch{await store.failed(id);return json({error:'GitHub 同步失败，反馈已保留，可重试'},502);}
 }catch{return json({error:'服务暂时不可用，请稍后重试'},503);}
 }
 const response=await currentWorker.fetch(request,env,ctx);
 if(request.method!=='GET'||response.status!==200||!response.headers.get('content-type')?.includes('text/html')||request.headers.has('rsc')||request.headers.has('next-router-state-tree')||response.headers.get('content-disposition')?.includes('attachment'))return response;
 const headers=new Headers(response.headers);for(const key of ['content-length','content-encoding','etag','content-md5','digest','content-digest','repr-digest','last-modified'])headers.delete(key);
 const page=new Response(response.body,{status:response.status,headers});
 const handler={element(e){e.append('<script src="/feedback-widget.js" defer></script>',{html:true});}};
 return rewriteHtml?rewriteHtml(page,handler):new HTMLRewriter().on('body',handler).transform(page);
 }};
}
