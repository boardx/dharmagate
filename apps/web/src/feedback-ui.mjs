export const feedbackScript = `
(()=>{
const admin=location.pathname==='/admin/feedback';
const root=document.createElement('div');document.body.append(root);
function el(tag,text,parent=root){const e=document.createElement(tag);if(text)e.textContent=text;parent.append(e);return e;}
async function api(path,body){const r=await fetch('/api/feedback'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||'操作失败，请重试');return data;}
if(admin){
 el('h1','用户反馈审核');el('p','审核反馈内容后批准，系统将创建 GitHub Issue。请勿将个人信息或敏感内容发布到公开仓库。');
 const filter=el('select');for(const [value,label] of [['pending','待审核'],['sync_failed','同步失败'],['syncing','同步中'],['published','已发布'],['rejected','已拒绝']]){const o=el('option',label,filter);o.value=value;}
 let offset=0;const list=el('section');const more=el('button','下一页');
 async function load(){list.replaceChildren();try{const data=await api('?status='+filter.value+'&offset='+offset);if(!data.items.length)el('p','暂无反馈',list);for(const item of data.items){const card=el('article',null,list);el('h2',item.title,card);el('p',item.description,card);el('p',item.category+' · '+item.page_path+' · '+item.created_at,card);if(item.issue_url){const a=el('a','查看 GitHub Issue',card);a.href=item.issue_url;a.rel='noopener noreferrer';}
 if(['pending','sync_failed'].includes(item.status)){const approve=el('button',item.status==='sync_failed'?'重试同步':'批准并创建 Issue',card);approve.onclick=async()=>{approve.disabled=true;try{await api('/'+item.id+'/approve',{});await load();}catch(e){el('p',e.message,card);approve.disabled=false;}};}
 if(item.status==='pending'){const note=el('input',null,card);note.placeholder='拒绝原因（选填）';note.maxLength=1000;const reject=el('button','拒绝',card);reject.onclick=async()=>{reject.disabled=true;try{await api('/'+item.id+'/reject',{note:note.value});await load();}catch(e){el('p',e.message,card);reject.disabled=false;}};}}
 more.disabled=!data.hasMore;
 }catch(e){el('p',e.message,list);}}
 filter.onchange=()=>{offset=0;load();};more.onclick=()=>{offset+=50;load();};load();return;}
const trigger=el('button','意见反馈');trigger.style.cssText='position:fixed;bottom:24px;right:20px;z-index:2147483000;padding:12px 18px;border-radius:24px;background:#235848;color:white;border:1px solid white;cursor:pointer';
const dialog=el('dialog');dialog.style.cssText='max-width:480px;width:calc(100% - 64px);padding:24px;border:1px solid #ddd;border-radius:16px';
el('h2','帮助我们改进 DharmaGate',dialog);el('p','反馈先由管理员审核，批准后会转为 GitHub Issue。请勿填写个人信息或敏感内容。',dialog);
const form=el('form',null,dialog);
function field(label,tag){const l=el('label',label,form);l.style.display='block';const f=el(tag,null,l);f.style.cssText='display:block;width:100%;box-sizing:border-box;margin:8px 0 16px;padding:8px';return f;}
const category=field('反馈类型','select');for(const [value,label] of [['bug','问题报告'],['idea','功能建议'],['content','内容纠错'],['other','其他']]){const o=el('option',label,category);o.value=value;}
const title=field('标题','input');title.required=true;title.maxLength=160;
const description=field('详细说明','textarea');description.required=true;description.maxLength=5000;description.rows=5;
const status=el('p',null,form);status.setAttribute('role','status');
const submit=el('button','提交反馈',form);submit.type='submit';const close=el('button','关闭',form);close.type='button';close.onclick=()=>dialog.close();trigger.onclick=()=>dialog.showModal();
form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;status.textContent='正在提交…';try{const data=await api('',{title:title.value,description:description.value,category:category.value,page_path:location.pathname});status.textContent='感谢反馈，已提交审核。编号：'+data.id;form.reset();}catch(e){status.textContent=e.message;}finally{submit.disabled=false;}};
})();`;
export const adminHtml='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>反馈审核 · DharmaGate</title><style>body{font:16px system-ui;max-width:900px;margin:32px auto;padding:0 20px;color:#243d34}article{padding:20px;border:1px solid #ddd;border-radius:12px;margin:16px 0}p{white-space:pre-wrap;overflow-wrap:anywhere}button,input,select{padding:10px;margin:6px}button{cursor:pointer}</style><body><script src="/feedback-widget.js" defer></script></body></html>';
