/** Render already reviewed research metadata; never infer findings from absent fields. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=value=>typeof value==='string'&&value.trim()?value:'未标明';
function safeURL(value){
 if(typeof value!=='string'||/[\u0000-\u0020\u007f]/.test(value))return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}
}
export function renderEvidence(research){
 const items=Array.isArray(research?.items)?research.items:[];
 return `<details class="panel evidence" id="evidence"><summary>声音、传统与科学：证据和方法</summary><p>${esc(text(research?.summary))}</p><p>留意声音、注意力和身体的主观感受，不把一次体验当作因果或医学结论。音量滑杆的百分比不是分贝；设备和耳机会影响实际声压。</p><ol class="evidence-list">${items.map(value=>{
  const item=value&&typeof value==='object'?value:{};const url=safeURL(item.url);
  return `<li class="evidence-study"><h3>${esc(text(item.title))}</h3><dl class="evidence-fields">${[['类型','kind'],['对象／纳入范围','participants'],['观察内容','observation'],['局限与适用边界','limitation']].map(([label,key])=>`<dt>${label}</dt><dd>${esc(text(item[key]))}</dd>`).join('')}</dl><details class="evidence-note"><summary>查看完整说明</summary><p>${esc(text(item.note))}</p></details>${url?`<a class="evidence-source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">查看原文来源 ↗</a>`:'<p class="evidence-source-unavailable">原文来源未标明或链接不可用</p>'}</li>`;
 }).join('')}</ol></details>`;
}
