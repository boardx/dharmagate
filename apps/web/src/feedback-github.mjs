export function createFeedbackGithub({token,repository,fetcher=fetch}) {
 if(!token||!/^[-\w.]+\/[-\w.]+$/.test(repository))throw new Error('GitHub feedback configuration required');
 const base=`https://api.github.com/repos/${repository}/issues`;
 async function call(url,options={}) {
  const r=await fetcher(url,{...options,signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'DharmaGate-feedback','Content-Type':'application/json'}});
  if(!r.ok)throw new Error('GitHub request failed');
  return r.json();
 }
 return {async publish(row) {
  const marker=`<!-- dharmagate-feedback:${row.id} -->`;
  // Reconcile uncertain previous POST outcomes before attempting another creation.
  for(let page=1;page<=100;page++) {
   const issues=await call(`${base}?state=all&per_page=100&page=${page}&sort=created&direction=desc`);
   const existing=issues.find(x=>!x.pull_request&&x.body?.includes(marker));
   if(existing)return existing;
   if(issues.length<100) return call(base,{method:'POST',body:JSON.stringify({title:`[用户反馈] ${row.title}`,body:`${marker}\n\n## 用户反馈\n${row.description}\n\n## 上下文\n- 类型：${row.category}\n- 页面：${row.page_path}\n- 提交时间：${row.created_at}\n- 反馈编号：${row.id}\n\n经管理员审核后转入开发。`})});
  }
  throw new Error('Issue reconciliation limit reached');
 }};
}
