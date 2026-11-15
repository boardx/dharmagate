export const SEARCH_ENTRY_HTML='<aside id="canon-evidence-search-entry" aria-label="原文检索"><p><a href="/resources/search">按原文检索 →</a></p><p>当前范围：《般若波羅蜜多心經》T08n0251。保留原句与出处；其余藏经仍使用上方经名、经号目录查询。</p></aside>';
export function addCanonSearchEntry(request,response){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.origin!=='https://dharmagate.us'||u.pathname!=='/canon/zh'||u.searchParams.has('unit')||response.status!==200||!response.headers.get('content-type')?.includes('text/html')||response.headers.has('content-disposition')||['rsc','next-router-state-tree','next-router-prefetch','next-url'].some(h=>request.headers.has(h))||typeof HTMLRewriter!=='function')return response;
 const headers=new Headers(response.headers);for(const h of ['content-length','content-encoding','etag','content-md5','digest','content-digest','repr-digest'])headers.delete(h);
 let inserted=false;return new HTMLRewriter().on('form#catalogue-search',{element(element){if(!inserted){element.after(SEARCH_ENTRY_HTML,{html:true});inserted=true}}}).transform(new Response(response.body,{status:response.status,statusText:response.statusText,headers}));
}
