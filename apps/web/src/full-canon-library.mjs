import {annotationLinksClient} from './canon-annotation-browser.mjs';
import {buildCanonBranches,canonTreeHtml,canonTreeCss,canonTreeClient} from './canon-tree.mjs';
import {readVerifiedCanonOriginal} from './canon-original-mirror.mjs';
import {renderDiscoveryPage} from './discovery-shell.mjs';

const MAX_JSON=8_000_000,MAX_PAGE=2_000_000;
const safeHeaders={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const json=(req,value,status=200)=>new Response(req.method==='HEAD'?null:JSON.stringify(value),{status,headers:{...safeHeaders,'content-type':'application/json;charset=utf-8'}});
const titleAliases={'T08n0235':['金刚经','金剛經'],'T08n0251':['心经','心經'],'T09n0262':['法华经','法華經'],'T09n0278':['华严经','華嚴經'],'T10n0279':['华严经','華嚴經'],'T13n0412':['地藏经','地藏經'],'T14n0450':['药师经','藥師經'],'T14n0475':['维摩诘经','維摩詰經'],'T17n0842':['圆觉经','圓覺經'],'T19n0945':['楞严经','楞嚴經'],'T48n2008':['六祖坛经','六祖壇經']}; // Search aliases only; publisher titles and body remain unchanged.
const searchPairs='剛刚詰诘維维壇坛羅罗藥药頂顶萬万誡诫琉琉璃璃來来誦诵綱纲錄录靈灵實实賢贤體体見见誠诚書书讚赞彙汇參参會会後后發发蓮莲懷怀' + '經经論论漢汉傳传長长說说華华嚴严觀观無无量量壽寿廣广寶宝積积師师藥药彌弥陀陀釋释迦迦羅罗門门學学習习義义疏疏淨净禪禅續续雜杂阿阿毘毗達达磨磨俱俱舍舍維维識识顯显密密圓圆覺觉涅涅槃槃般般若若諸诸佛佛薩萨菩菩儀仪懺忏願愿願愿勸劝發发願愿樂乐莊庄嚴严聖圣聲声聞闻緣缘證证國国龍龙樹树綱纲鈔钞抄抄選选集集';
const searchMap=new Map(Array.from(searchPairs.matchAll(/(.)(.)/gu),m=>[m[1],m[2]]));
const foldSearch=s=>Array.from(String(s).normalize('NFKC').toLowerCase(),c=>searchMap.get(c)??c).join('');
const unitPattern=/^[A-Z]{1,2}\d{2,3}n[0-9A-Za-z_-]{1,24}$/;
const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');

/** Reads only fixed immutable public canon objects. Never lists or writes a bucket. */
export function createFullCanonLibrary({bootstrap,readObject,fetchSource=globalThis.fetch,browserReaderScript=''}={}) {
  if(!/^[a-f0-9]{40}$/.test(bootstrap?.commit))throw Error('CANON_BOOTSTRAP_REQUIRED');
  const prefix='canon/'+bootstrap.commit+'/';let cachedCatalogue;
  function valid(record,max){
    if(!record||typeof record.key!=='string'||!record.key.startsWith(prefix)||record.key.includes('..')||! /^[a-f0-9]{64}$/.test(record.sha256)||!Number.isInteger(record.bytes)||record.bytes<1||record.bytes>max)throw Error('INVALID_OBJECT_RECORD');
    if(record.range&&(!/^shards(?:-8m)?\/\d{5}\.bin$/.test(record.key.slice(prefix.length))||!Number.isSafeInteger(record.range.offset)||record.range.offset<0||record.range.length!==record.bytes||record.range.offset+record.bytes>64*1024*1024))throw Error('INVALID_RANGE');
    if(record.encoding!=='gzip'||!Number.isInteger(record.decodedBytes)||record.decodedBytes<1||record.decodedBytes>max||! /^[a-f0-9]{64}$/.test(record.decodedSha256))throw Error('INVALID_ENCODING');
  }
  async function bounded(stream,length){
    const reader=stream.getReader(),chunks=[];let count=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>length){await reader.cancel();throw Error('OBJECT_OVERFLOW')}chunks.push(value)}}finally{reader.releaseLock()}
    if(count!==length)throw Error('OBJECT_TRUNCATED');
    const bytes=new Uint8Array(count);let offset=0;for(const b of chunks){bytes.set(b,offset);offset+=b.byteLength}return bytes;
  }
  async function checked(record,read,max=MAX_JSON,raw=false) {
    valid(record,max);const object=await read(record.key,record.range?{range:record.range}:undefined);
    if(!object?.body||(record.range?object.size<record.range.offset+record.bytes:object.size!==record.bytes))throw Error('OBJECT_MISSING_OR_SIZE');
    const encoded=await bounded(object.body,record.bytes);
    if(hex(await crypto.subtle.digest('SHA-256',encoded))!==record.sha256)throw Error('OBJECT_HASH');
    const bytes=await bounded(new Blob([encoded]).stream().pipeThrough(new DecompressionStream('gzip')),record.decodedBytes);
    if(hex(await crypto.subtle.digest('SHA-256',bytes))!==record.decodedSha256)throw Error('DECODED_OBJECT_HASH');
    return raw?bytes:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }
  async function catalogue(read){
    if(cachedCatalogue)return cachedCatalogue;
    const data=await checked(bootstrap.catalogue,read);
    if(data.commit!==bootstrap.commit||!Array.isArray(data.items)||data.items.length!==bootstrap.sourceUnits||data.items.length>10000)throw Error('CATALOGUE_MISMATCH');
    const seen=new Set();for(const row of data.items){if(!unitPattern.test(row.id)||seen.has(row.id)||!(bootstrap.sourceReader?Object.keys(bootstrap.counts):['T','X','J','N']).includes(row.collection))throw Error('CATALOGUE_UNIT_INVALID');if(!bootstrap.sourceReader)valid(row.manifest,MAX_JSON);else if(!/^[a-f0-9]{64}$/.test(row.readingSha256)||row.rightsEligible!==true)throw Error('SOURCE_ROW_INVALID');seen.add(row.id)}
    if(bootstrap.sourceReader){const total=data.items.reduce((n,r)=>n+r.sourceBytes,0);if(total!==bootstrap.sourceBytesTotal||total+(bootstrap.legacyStoredBytesUpperBound??250_000_000)>4_000_000_000)throw Error('SOURCE_STORAGE_SCOPE');}
    const order=['T','N','X','J','A','B','C','CC','D','F','G','GA','GB','I','K','L','M','P','S','U','ZS','ZW'];data.items.sort((a,b)=>order.indexOf(a.collection)-order.indexOf(b.collection)||(a.id<b.id?-1:a.id>b.id?1:0));
    cachedCatalogue=data;return data;
  }
  async function manifest(id,read){
    if(!unitPattern.test(id))return null;
    const data=await catalogue(read),row=data.items.find(r=>r.id===id);if(!row)return null;
    if(bootstrap.sourceReader)return {...row,relatedUnits:row.workId?data.items.filter(r=>r.workId===row.workId).map(({id,title,extent,juan})=>({id,title,extent,juan})):[],commit:bootstrap.commit,readingMode:'verified-original-xml',expectedPages:row.pages,pages:[],humanAccepted:false,aiTranslated:false};
    const item=await checked(row.manifest,read);
    if(item.id!==id||item.commit!==bootstrap.commit||!Array.isArray(item.pages))throw Error('UNIT_MANIFEST_INVALID');
    for(const p of item.pages)valid(p,MAX_PAGE);valid(item.sourceObject,32_000_000);
    return item;
  }
  return {async fetch(request,providedReadObject){
    const read=providedReadObject??readObject;
    const u=new URL(request.url),path=u.pathname;
    if(path!=='/canon/zh'&&!path.startsWith('/canon/zh/'))return null;
    if(!['GET','HEAD'].includes(request.method))return json(request,{error:'method_not_allowed'},405);
    try{
      if(typeof read!=='function')throw Error('CANON_STORAGE_REQUIRED');
      if(path==='/canon/zh/api/catalogue'){
        const q=(u.searchParams.get('q')??'').trim(),collection=u.searchParams.get('collection')??'',page=Number(u.searchParams.get('page')??'1');
        if(q.length>80||collection&&!(bootstrap.sourceReader?Object.keys(bootstrap.counts):['T','X','J','N']).includes(collection)||!Number.isInteger(page)||page<1||page>10000)return json(request,{error:'invalid_filter'},400);
        const data=await catalogue(read),found=data.items.filter(r=>(!collection||r.collection===collection)&&(!q||foldSearch([r.id,r.workId,r.title,...r.authors,...(titleAliases[r.id]??[])].join(' ')).includes(foldSearch(q))));
        return json(request,{commit:bootstrap.commit,sourceUnits:data.sourceUnits,workIdentifiers:data.workIdentifiers,collectionCounts:data.collectionCounts,filteredUnits:found.length,page,pageSize:24,items:found.slice((page-1)*24,page*24).map(({id,workId,title,authors,extent,collection,volume,pages,juan,publicationEligible,qualityWarnings})=>({id,workId,title,authors,extent,collection,volume,pages,juan,publicationEligible,qualityWarnings})),worldComplete:false,humanAccepted:false});
      }
      if(path==='/canon/zh/api/tree'){
        const q=(u.searchParams.get('q')??'').trim(),collection=u.searchParams.get('collection')??'',volume=u.searchParams.get('volume')??'',page=Number(u.searchParams.get('page')??'1');
        if(q.length>80||collection&&!(bootstrap.sourceReader?Object.keys(bootstrap.counts):['T','X','J','N']).includes(collection)||volume&&!/^[A-Z]{1,2}\d{2,3}$/.test(volume)||!Number.isInteger(page)||page<1||page>10000)return json(request,{error:'invalid_filter'},400);
        const data=await catalogue(read),found=data.items.filter(r=>(!collection||r.collection===collection)&&(!volume||(r.volume||r.id.split('n')[0])===volume)&&(!q||foldSearch([r.id,r.workId,r.title,...r.authors,...(titleAliases[r.id]??[])].join(' ')).includes(foldSearch(q))));
        if(volume)return json(request,{commit:bootstrap.commit,filteredUnits:found.length,page,pageSize:100,items:found.slice((page-1)*100,page*100).map(({id,title,authors,extent,collection,volume,juan,publicationEligible})=>({id,title,authors,extent,collection,volume,juan,publicationEligible}))});
        return json(request,{commit:bootstrap.commit,sourceUnits:data.sourceUnits,filteredUnits:found.length,collections:buildCanonBranches(found),classification:'source-collection-volume-unit-juan',sourceOnlyUnits:found.filter(r=>r.publicationEligible!==true).length,figureUnits:found.filter(r=>r.qualityWarnings?.includes('figure-not-reproduced')).length,worldComplete:false});
      }
      if(path.startsWith('/canon/zh/api/unit/')){
        if(u.search)return json(request,{error:'not_found'},404);
        const item=await manifest(path.slice('/canon/zh/api/unit/'.length),read);return item?json(request,item):json(request,{error:'not_found'},404);
      }
      if(path.startsWith('/canon/zh/api/page/')){
        const id=path.slice('/canon/zh/api/page/'.length),page=Number(u.searchParams.get('page')??'1');
        if(!Number.isInteger(page)||page<1)return json(request,{error:'invalid_page'},400);
        const item=await manifest(id,read);if(!item)return json(request,{error:'not_found'},404);
        if(bootstrap.sourceReader)return json(request,{error:'use_verified_original_reader',sourcePreserved:true},409);
        if(item.publicationEligible!==true)return json(request,{error:'reading_view_requires_review',sourcePreserved:true},409);
        const record=item.pages[page-1];if(!record)return json(request,{error:'not_found'},404);
        const data=await checked(record,read,MAX_PAGE);
        if(data.unit!==id||data.page!==page||data.aiTranslated!==false)return json(request,{error:'page_identity_mismatch'},503);
        return json(request,{...data,title:item.title,authors:item.authors,pageCount:item.pages.length,qualityWarnings:item.qualityWarnings,sourcePath:item.sourcePath,commit:bootstrap.commit,sourceDate:item.sourceDate,license:'CC BY-NC-SA 4.0',humanAccepted:false});
      }
      if(path.startsWith('/canon/zh/api/source/')){
        if(u.search&&u.search!=='?format=receipt')return json(request,{error:'not_found'},404);
        const id=path.slice('/canon/zh/api/source/'.length),item=await manifest(id,read);
        if(!item)return json(request,{error:'not_found'},404);
        if(item.rightsEligible!==true)return json(request,{error:'source_rights_unconfirmed'},409);
        if(bootstrap.sourceReader){
          if(request.method==='HEAD')return new Response(null,{headers:{...safeHeaders,'content-type':'application/xml;charset=utf-8','content-length':String(item.sourceBytes)}});
          const original=await readVerifiedCanonOriginal({row:item,commit:bootstrap.commit,read,fetchSource,receiptOnly:u.search==='?format=receipt'});
          if(u.search==='?format=receipt')return json(request,{id,commit:bootstrap.commit,size:original.size,sha256:original.sha256,receipt:original.receipt,fromCache:original.fromCache});
          return new Response(original.bytes,{headers:{...safeHeaders,'content-type':'application/xml;charset=utf-8','content-disposition':'attachment; filename="'+id+'.xml"','x-canon-source-sha256':original.sha256}});
        }
        if(request.method==='HEAD')return new Response(null,{headers:{...safeHeaders,'content-type':'application/xml;charset=utf-8','content-length':String(item.sourceObject.decodedBytes),'content-disposition':'attachment; filename="'+id+'.xml"'}});
        const bytes=await checked(item.sourceObject,read,32_000_000,true);
        return new Response(request.method==='HEAD'?null:bytes,{headers:{...safeHeaders,'content-type':'application/xml;charset=utf-8','content-disposition':'attachment; filename="'+id+'.xml"'}});
      }
      if(path==='/canon/zh/api/release-status'){
        const index=Number(u.searchParams.get('shard'));
        if(!u.searchParams.has('shard')||!Number.isInteger(index)||index<0||index>=bootstrap.shards.length)return json(request,{error:'invalid_shard'},400);
        if(typeof read.head!=='function')throw Error('CANON_HEAD_UNAVAILABLE');
        const expected=bootstrap.shards[index],actual=await read.head(expected.key);
        return json(request,{index,verified:actual?.size===expected.bytes&&actual?.etag===expected.md5,bytes:actual?.size??null});
      }
      if(path==='/canon/zh/client.js')return new Response(request.method==='HEAD'?null:browserReaderScript+'\n'+annotationLinksClient+'\n'+canonTreeClient+'\n'+client,{headers:{...safeHeaders,'content-type':'text/javascript;charset=utf-8'}});
      if(path!=='/canon/zh'&&path!=='/canon/zh/')return json(request,{error:'not_found'},404);
      return renderDiscoveryPage(request,'中文經律論全藏',`<p class="eyebrow">中文經律論 · 權威原文</p><h1 id="title">中文經律論全藏</h1><p class="lede" id="canon-intro">依CBETA固定版本收錄已核授權中文藏經，包括大正藏、卍續藏、嘉興藏、漢譯南傳藏及其他開放藏別。原文、卷次、出處和校勘保留；不使用AI翻譯。分冊文件數不等於獨立經典數，亦不代表所有傳承均已有完整中文譯本。</p><form id="catalogue-search"><label class="visually-hidden" for="query">經名或經號</label><input type="search" id="query" maxlength="80" placeholder="經名或經號，例如 長阿含經、T01n0001"><label>藏別<select id="collection"><option value="">全部</option><option value="T">大正藏</option><option value="X">卍續藏</option><option value="J">嘉興藏</option><option value="N">漢譯南傳藏</option><option value="A">趙城金藏</option><option value="B">大藏經補編</option><option value="C">中華大藏經</option><option value="CC">CBETA選集</option><option value="D">國圖善本</option><option value="F">房山石經</option><option value="G">佛教大藏經</option><option value="GA">中國佛寺史志彙刊</option><option value="GB">中國佛寺志叢刊</option><option value="I">北朝石刻</option><option value="K">高麗藏</option><option value="L">乾隆藏</option><option value="M">卍正藏</option><option value="P">永樂北藏</option><option value="S">宋藏遺珍</option><option value="U">洪武南藏</option><option value="ZS">正史佛教資料</option><option value="ZW">藏外文獻</option></select></label><button type="submit">查經典</button></form><p id="status" role="status"></p>${canonTreeHtml}<section id="catalogue" class="grid"></section><div id="catalogue-pager" class="pager"><button id="prev-catalogue">上一頁</button><button id="next-catalogue">下一頁</button></div><section id="book" hidden><p><a id="back-catalogue" href="/canon/zh">← 返回全藏目錄</a></p><p id="reading-scope" class="source-notice"></p><nav id="reading-related" aria-label="本經號的來源分冊"></nav><div class="controls"><label>卷次<select id="juan"></select></label><button id="font">大字</button><button id="night">夜讀</button></div><details><summary>版本、署名與出版聲明</summary><p id="source-info" class="muted"></p><a id="source-link" rel="noopener noreferrer">下載完整原始XML</a><p>CBETA／各底本出版與貢獻者依原始header列示。公益非商業使用，保留版本、署名及實質內容，依逐項所示CC BY-NC-SA4.0或CC BY2.5流通；不含未獲另行授權的B類例外。本站只轉換閱讀呈現，不變動實質內容；原始XML另存，校注與異文不拼入正文。發現原資料錯誤可向CBETA基金會回報；基金會不承擔使用此資料造成的損害。再散布時請一併保留本說明、來源版本及署名，其中NC-SA4.0條目須非商業並相同方式分享；BY2.5條目依署名條款流通，不附加前述限制。</p><pre id="header" class="source-text"></pre><a href="https://cbeta.org/copyright" rel="noopener noreferrer">完整授權及例外</a></details><div class="pager"><button id="prev-page">上一頁</button><span id="page-label"></span><button id="next-page">下一頁</button></div><article id="reading" class="reading-page"></article><p id="reading-end" class="muted" role="status"></p><div class="pager" aria-label="阅读翻页"><button id="prev-page-bottom">上一頁</button><a href="#title">回到篇首 ↑</a><button id="next-page-bottom">下一頁</button></div><details><summary>本頁校注與異文</summary><section id="annotations"></section></details><details id="all-annotations"><summary>本分冊全部校注與異文</summary><p class="muted">按來源校注記錄順序完整列出，包含嵌套記錄及未綁定到正文行的校注；不猜測它們屬於哪個閱讀頁。</p><div class="pager"><button id="prev-notes" type="button">上一組校注</button><span id="notes-label" role="status"></span><button id="next-notes" type="button">下一組校注</button></div><section id="all-notes"></section></details></section>`, '/canon/zh/client.js',canonTreeCss);
    }catch(error){return json(request,{error:error?.message==='SOURCE_BUSY'?'verified_source_busy_retry':'verified_canon_storage_unavailable'},503)}
  }};
}

const client=String.raw`(()=>{'use strict';const $=id=>document.getElementById(id),params=new URL(location.href).searchParams;let cataloguePage=1,total=0,unit=params.get('unit')||'',page=Number(params.get('page')||1),manifest,originalView,catalogueRequest=0,large=false,night=false,notesPage=1;const status=t=>$('status').textContent=t,make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
let view=params.get('view')==='list'?'list':'tree';const tree=globalThis.DharmaGateCanonTree.create({root:$('canon-tree'),status});
function browseUrl(){const p=new URLSearchParams({view});if($('query').value)p.set('q',$('query').value);if($('collection').value)p.set('collection',$('collection').value);if(params.get('open'))p.set('open',params.get('open'));return '/canon/zh?'+p}
function showRelated(){$('reading-related').replaceChildren();if(manifest.relatedUnits?.length>1){$('reading-scope').textContent+=' 此經號共有 '+manifest.relatedUnits.length+' 個來源分冊，可逐冊閱讀：';for(const other of manifest.relatedUnits){const a=make('a',other.id+' · '+other.title);a.href=browseUrl()+'&unit='+encodeURIComponent(other.id);if(other.id===unit)a.setAttribute('aria-current','page');$('reading-related').append(a)}}}
function annotationBox(note){const box=make('div');if(note.locator)box.append(make('small','原版定位 '+note.locator));box.append(make('p',note.text||''));const more=make('details');more.append(make('summary','原始校注結構'),make('pre',note.xml||''));box.append(more);return box}
function renderAllNotes(){if(!originalView)return;const notes=originalView.notes,limit=100,totalPages=Math.max(1,Math.ceil(notes.length/limit));notesPage=Math.max(1,Math.min(notesPage,totalPages));$('all-notes').replaceChildren();for(const note of notes.slice((notesPage-1)*limit,notesPage*limit))$('all-notes').append(annotationBox(note));$('notes-label').textContent='共 '+notes.length+' 條來源校注記錄 · 第 '+notesPage+' / '+totalPages+' 組';$('prev-notes').disabled=notesPage<=1;$('next-notes').disabled=notesPage>=totalPages}
function toggleView(){const isTree=view==='tree';$('catalogue').hidden=isTree;$('catalogue-pager').hidden=isTree;$('canon-tree').hidden=!isTree;$('tree-help').hidden=!isTree;$('collapse-tree').hidden=!isTree;$('view-tree').setAttribute('aria-pressed',String(isTree));$('view-list').setAttribute('aria-pressed',String(!isTree))}
async function list(){const generation=++catalogueRequest;toggleView();if(view==='tree'){return tree.load({q:$('query').value,collection:$('collection').value,open:params.get('open')||''})}tree.cancel();try{status('正在讀取已校驗全藏目錄…');const p=new URLSearchParams({q:$('query').value,collection:$('collection').value,page:String(cataloguePage)}),r=await fetch('/canon/zh/api/catalogue?'+p);if(!r.ok)throw Error('全藏儲存暫不可用，未展示未校驗資料');const d=await r.json();if(generation!==catalogueRequest)return;total=d.filteredUnits;$('catalogue').replaceChildren();for(const row of d.items){const card=make('article');card.className='card';const h=make('h2'),a=make('a',row.title);a.href=browseUrl()+'&unit='+encodeURIComponent(row.id);h.append(a);card.append(h,make('p',row.id+' · '+row.extent),make('p',row.authors.join('、')),make('small',row.publicationEligible?'權威中文原文；首次核驗後存入本站藏經庫':'官方原件可核驗；此閱讀層待專項校核'));$('catalogue').append(card)}$('prev-catalogue').disabled=cataloguePage<=1;$('next-catalogue').disabled=cataloguePage*24>=total;status('已校驗目錄 '+d.sourceUnits+' 個分冊／分篇文件，版本經號 '+d.workIdentifiers+' 個；本次找到 '+total+' 項。不是全球佛典已全部收齊。')}catch(error){if(generation===catalogueRequest)throw error}}
async function loadBook(){const r=await fetch('/canon/zh/api/unit/'+encodeURIComponent(unit));if(!r.ok)throw Error('此版本原件暫不可用');manifest=await r.json();if(manifest.publicationEligible!==true){$('canon-browse').hidden=true;$('back-catalogue').href=browseUrl();$('catalogue-search').hidden=true;$('canon-intro').hidden=true;$('book').hidden=false;$('catalogue').hidden=true;$('catalogue-pager').hidden=true;$('title').textContent=manifest.title;$('source-link').href='/canon/zh/api/source/'+encodeURIComponent(unit);$('source-info').textContent=manifest.authors.join('、')+' · '+(manifest.license||'CC BY-NC-SA 4.0');$('header').textContent='完整出版聲明與署名見原始XML。';$('reading-scope').textContent='本單元 '+unit+' 的原始XML已納入核驗目錄；對照結構的網頁閱讀層尚待校核，暫不展示可能有遺漏的正文。請展開「版本、署名與出版聲明」下載完整原件。';for(const e of $('book').querySelectorAll('.controls,.pager,#reading,#all-annotations'))e.hidden=true;showRelated();status('原件可下載；網頁閱讀層待校核。');return}if(manifest.readingMode==='verified-original-xml'){status('正在核驗官方中文原件，首次載入後存入本站藏經庫…');const source=await fetch('/canon/zh/api/source/'+encodeURIComponent(unit));if(!source.ok)throw Error('官方原件暫不可用，未顯示未核驗內容');const bytes=await source.arrayBuffer();if(bytes.byteLength!==manifest.sourceBytes||await DharmaGateTEI.sha256(bytes)!==manifest.rawSha256)throw Error('原件雜湊不一致');originalView=DharmaGateTEI.convertPublisherXml(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(originalView.id!==unit||await DharmaGateTEI.sha256(new TextEncoder().encode(JSON.stringify(DharmaGateTEI.readingModel(originalView))))!==manifest.readingSha256||originalView.pages.length!==manifest.expectedPages)throw Error('閱讀呈現核對未通過，請使用完整原件');manifest.sourceHeaderXml=originalView.sourceHeaderXml;manifest.pages=originalView.pages} else originalView=null;$('canon-browse').hidden=true;$('back-catalogue').href=browseUrl();$('catalogue-search').hidden=true;$('canon-intro').hidden=true;$('book').hidden=false;$('catalogue').hidden=true;$('catalogue-pager').hidden=true;$('title').textContent=manifest.title;$('header').textContent=manifest.sourceHeaderXml||'完整header見原始XML';$('source-link').href='/canon/zh/api/source/'+encodeURIComponent(unit);$('reading-scope').textContent='當前來源單元 '+unit+'：'+manifest.extent+'，'+(manifest.lineCount??'—')+' 行，本站分為 '+manifest.pages.length+' 個閱讀頁。閱讀頁是網頁分段，不是原書頁碼；一頁短經不等於缺頁。';if(originalView?.lines.some(line=>/\p{Co}/u.test(line.text)))$('reading-scope').textContent+=' 本文含來源專用字形；裝置未安裝相應字型時可能顯示空框，完整XML保留缺字／悉曇字的字形描述，本站不猜改文字。';showRelated();$('source-info').textContent=manifest.authors.join('、')+' · '+manifest.sourceDate+' · '+(manifest.license||'CC BY-NC-SA 4.0')+' · CBETA校訂正文，校勘單列，不作AI翻譯';$('juan').replaceChildren();for(const j of [...new Set(manifest.pages.map(p=>p.juan))]){const o=make('option','卷 '+j);o.value=j;$('juan').append(o)}if(!Number.isInteger(page)||page<1||page>manifest.pages.length)page=1;if(params.has('juan')){const first=manifest.pages.findIndex(p=>String(p.juan)===params.get('juan'));if(first>=0)page=first+1}await loadPage()}
async function loadPage(){status('正在核對中文原文與版本…');let d;if(originalView){if(manifest.publicationEligible!==true)throw Error('原件已保留，複雜對照結構閱讀層待核，請下載原始XML。');d={...originalView.pages[page-1],pageCount:originalView.pages.length,qualityWarnings:manifest.qualityWarnings};if(!d.lines)throw Error('頁碼不存在')}else{const r=await fetch('/canon/zh/api/page/'+encodeURIComponent(unit)+'?page='+page);if(r.status===409)throw Error('原件已保留，此閱讀層仍有待核結構；請先查看官方原始版本。');if(!r.ok)throw Error('此頁來源校驗未通過或暫不可用');d=await r.json()}$('reading').replaceChildren();for(const line of d.lines){const p=make('div');p.id=line.id;p.className='source-line';const a=make('a','¶');a.href='#'+line.id;a.setAttribute('aria-label','引用 '+line.id);p.append(a,document.createTextNode(line.text));$('reading').append(p)}$('reading-end').textContent=page===d.pageCount?(manifest.relatedUnits?.length>1?'本來源單元已讀至末尾。此經跨冊，請在篇首「本經號的來源分冊」繼續閱讀。':'本來源單元已讀至末尾；本經號在目前目錄中沒有其他分冊。'):'';$('annotations').replaceChildren();const annotations=originalView?globalThis.DharmaGateExpandAnnotations(originalView.notes,d.annotations):d.annotations;for(const note of annotations)$('annotations').append(annotationBox(note));$('juan').value=d.juan;$('page-label').textContent='卷 '+d.juan+' · '+page+' / '+d.pageCount+' 閱讀頁';for(const id of ['prev-page','prev-page-bottom'])$(id).disabled=page<=1;for(const id of ['next-page','next-page-bottom'])$(id).disabled=page>=d.pageCount;history.replaceState(null,'',browseUrl()+'&unit='+encodeURIComponent(unit)+'&page='+page+location.hash);status('原件校驗碼與閱讀轉換一致；不是逐字人工校勘。'+(d.qualityWarnings.includes('figure-not-reproduced')?' 原版圖像未在此複製，請見來源原件。':'')+(d.qualityWarnings.some(w=>w.startsWith('unresolved-glyph:'))?' 部分缺字以代碼保留，請對照原件。':''));if(location.hash)document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView()}
const fail=e=>status(e.message||'讀取失敗');$('catalogue-search').onsubmit=e=>{e.preventDefault();unit='';$('book').hidden=true;$('catalogue').hidden=false;$('catalogue-pager').hidden=false;cataloguePage=1;if(typeof history!=='undefined')history.replaceState(null,'',browseUrl());list().catch(fail)};$('prev-catalogue').onclick=()=>{if(cataloguePage>1){cataloguePage--;list().catch(fail)}};$('next-catalogue').onclick=()=>{cataloguePage++;list().catch(fail)};$('juan').onchange=()=>{page=manifest.pages.findIndex(p=>p.juan===$('juan').value)+1;loadPage().catch(fail)};for(const [id,delta]of [['prev-page',-1],['next-page',1],['prev-page-bottom',-1],['next-page-bottom',1]])$(id).onclick=()=>{if(page+delta<1||page+delta>manifest.pages.length)return;page+=delta;loadPage().then(()=>$('reading').scrollIntoView()).catch(fail)};$('font').onclick=()=>{$('reading').classList.toggle('large',large=!large);$('font').textContent=large?'標準字':'大字'};$('night').onclick=()=>{$('reading').classList.toggle('night',night=!night);$('night').textContent=night?'日讀':'夜讀'};$('query').value=params.get('q')||'';$('collection').value=params.get('collection')||'';for(const v of ['tree','list'])$('view-'+v).onclick=()=>{view=v;cataloguePage=1;history.replaceState(null,'',browseUrl());list().catch(fail)};$('collapse-tree').onclick=()=>tree.collapse();$('all-annotations').ontoggle=()=>{if($('all-annotations').open)renderAllNotes()};$('prev-notes').onclick=()=>{if(notesPage>1){notesPage--;renderAllNotes()}};$('next-notes').onclick=()=>{if(originalView&&notesPage*100<originalView.notes.length){notesPage++;renderAllNotes()}};if(unit)loadBook().catch(fail);else list().catch(fail)})();`;
