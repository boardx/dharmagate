// Deterministic publisher XML reading view; never translates or evaluates XML.
export function convertPublisherXml(xml,{DOMParser:Parser=globalThis.DOMParser,XMLSerializer:Serializer=globalThis.XMLSerializer}={}){
 if(typeof xml!=='string'||xml.length>32_000_000||/<!DOCTYPE|<!ENTITY/.test(xml))throw Error('XML_DECLARATION_DENIED');
 const doc=new Parser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('XML_PARSE');
 const ns='http://www.tei-c.org/ns/1.0',xmlns='http://www.w3.org/XML/1998/namespace',all=(n,tag)=>Array.from(n.getElementsByTagNameNS(ns,tag)),first=(n,tag)=>all(n,tag)[0],txt=n=>n?.textContent?.trim()??'',serialize=n=>new Serializer().serializeToString(n),attrs=n=>Object.fromEntries(Array.from(n.attributes??[]).filter(a=>a.namespaceURI!=='http://www.w3.org/2000/xmlns/').map(a=>[a.namespaceURI&&a.namespaceURI!==xmlns?'{'+a.namespaceURI+'}'+a.localName:a.namespaceURI===xmlns?'{'+xmlns+'}'+a.localName:a.name,a.value]));
 const root=doc.documentElement,unit=root.getAttributeNS(xmlns,'id'),canon=unit.match(/^[A-Z]+/)?.[0],header=first(root,'teiHeader'),body=first(root,'body');if(!header||!body||!unit)throw Error('TEI_REQUIRED');
 const glyphs=new Map(),descriptions=new Map();for(const char of all(header,'char')){const id=char.getAttributeNS(xmlns,'id');for(const m of all(char,'mapping'))if(m.getAttribute('type')==='unicode'&&/^(?:U\+[0-9A-Fa-f]+\s*)+$/.test(txt(m)))glyphs.set(id,Array.from(txt(m).matchAll(/U\+([0-9A-Fa-f]+)/g),x=>String.fromCodePoint(parseInt(x[1],16))).join(''));for(const p of all(char,'charProp'))if(txt(first(p,'localName'))==='composition')descriptions.set(id,txt(first(p,'value')))}
 const lines=[],notes=[],toc=[],warnings=new Set(),seen=new Map();let current=[],anchors=[],juan='0',locator='front';
 const emit=v=>{if(v&&!/^\s*$/.test(v))current.push(v.replace(/[\r\n\t]/g,''))};
 const flush=()=>{const value=current.join('');if(value.trim()||anchors.length){let id=unit+':'+locator,n=(seen.get(id)||0)+1;seen.set(id,n);if(n>1)id+='.'+n;lines.push({id,locator,juan,text:value,anchorIds:anchors})}current=[];anchors=[]};
 const walk=node=>{if(node.nodeType===3||node.nodeType===4){emit(node.nodeValue);return}if(node.nodeType!==1)return;const tag=node.localName;
  if(tag==='mulu'){toc.push({title:txt(node),level:node.getAttribute('level')||null,juan,locator});return}
  if(['note','app','tt'].includes(tag)){notes.push({kind:tag,attributes:attrs(node),xml:serialize(node),text:txt(node),locator,juan});if(tag!=='note'){warnings.add('inline-'+tag+'-requires-review');emit('〔原文'+tag+'結構見校注〕')}return}
  if(tag==='milestone'&&node.getAttribute('unit')==='juan'){flush();juan=node.getAttribute('n')||'unknown';locator='juan-'+juan;return}
  if(tag==='lb'){if((node.getAttribute('ed')||canon)===canon){flush();locator=node.getAttribute('n')||locator}return}
  if(tag==='pb')return;
  if(tag==='anchor'){const id=node.getAttributeNS(xmlns,'id');if(id)anchors.push(id);return}
  if(tag==='g'){const code=(node.getAttribute('ref')||'').replace(/^#/,'');if(node.firstChild?.nodeType===3&&node.firstChild.nodeValue)emit(node.firstChild.nodeValue);else if(glyphs.has(code))emit(glyphs.get(code));else{emit('〔缺字 '+code+' '+(descriptions.get(code)||'')+'〕');warnings.add('unresolved-glyph:'+code)}return}
  if(tag==='choice'){const preferred=Array.from(node.children).find(n=>['corr','reg'].includes(n.localName));if(preferred)walk(preferred);else{warnings.add('unresolved-choice');emit('〔原文異讀待核〕')}notes.push({kind:'choice',xml:serialize(node),locator,juan});return}
  if(['figure','graphic'].includes(tag)){notes.push({kind:tag,attributes:attrs(node),xml:serialize(node),text:txt(node),locator,juan});emit('〔原版圖像見來源；未在此複製〕');warnings.add('figure-not-reproduced');return}
  if(tag==='gap'){emit('〔原文缺損〕');warnings.add('source-gap');return}
  if(tag==='space'||tag==='caesura'){const q=node.getAttribute('quantity')||'1';current.push('　'.repeat(Math.min(8,/^\d+$/.test(q)?Number(q):1)));return}
  if(['ref','ptr'].includes(tag)&&(node.getAttribute('target')||node.getAttribute('cRef')))notes.push({kind:'reference',attributes:attrs(node),text:txt(node),locator,juan});
  for(const child of Array.from(node.childNodes))walk(child);if(['l','row'].includes(tag))current.push('\n');if(tag==='cell')current.push('　');
 };walk(body);flush();const back=first(root,'back');if(back)for(const n of Array.from(back.getElementsByTagName('*')))if(['note','app','tt'].includes(n.localName))notes.push({kind:'stand-off-'+n.localName,attributes:attrs(n),xml:serialize(n),text:txt(n)});
 const byAnchor=new Map(),byLocation=new Map();notes.forEach((n,i)=>{for(const key of ['target','from','to'])for(const token of(n.attributes?.[key]||'').split(/\s+/).filter(Boolean)){const a=token.replace(/^#/,'');if(!byAnchor.has(a))byAnchor.set(a,[]);byAnchor.get(a).push(i)}if(n.locator){if(!byLocation.has(n.locator))byLocation.set(n.locator,[]);byLocation.get(n.locator).push(i)}});
 const volumes=new Map();for(const line of lines){if(!volumes.has(line.juan))volumes.set(line.juan,[]);volumes.get(line.juan).push(line)}const pages=[];for(const [j,ls]of volumes)for(let i=0;i<ls.length;i+=120){const pageLines=ls.slice(i,i+120),indices=new Set();for(const line of pageLines){for(const n of byLocation.get(line.locator)||[])indices.add(n);for(const a of line.anchorIds)for(const n of byAnchor.get(a)||[])indices.add(n)}pages.push({unit,juan:j,page:pages.length+1,lines:pageLines,annotations:Array.from(indices).sort((a,b)=>a-b).map(n=>notes[n]),aiTranslated:false})}
 return {id:unit,sourceHeaderXml:'<teiHeader>'+xml.split('<teiHeader>')[1]?.split('</teiHeader>')[0]+'</teiHeader>',lines,toc,notes,pages,qualityWarnings:Array.from(warnings).sort()};
}
export const readingModel=d=>[d.lines.map(l=>[l.id,l.locator,l.juan,l.text,l.anchorIds]),d.notes.map(n=>[n.kind,n.text??'',n.locator??null,n.juan??null,Object.entries(n.attributes??{}).sort(([a],[b])=>a<b?-1:a>b?1:0)]),d.toc.map(t=>[t.title,t.level??null,t.juan,t.locator])];

export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
