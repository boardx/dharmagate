/** Calendar grouping is local to the viewer; elapsed seconds never derive from wall-clock ranges. */
export function groupHistoryByDay(rows,{timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone,preserveOrder=false}={}){
 const keyFormat=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}),labelFormat=new Intl.DateTimeFormat('zh-CN',{timeZone,dateStyle:'full'}),groups=new Map();
 for(const row of rows){if(!Number.isFinite(row.startedAt)||!Number.isInteger(row.elapsedSeconds)||row.elapsedSeconds<0)throw Error('INVALID_HISTORY_ROW');const parts=Object.fromEntries(keyFormat.formatToParts(row.startedAt).filter(p=>p.type!=='literal').map(p=>[p.type,p.value])),key=parts.year+'-'+parts.month+'-'+parts.day;let group=groups.get(key);if(!group){group={key,label:labelFormat.format(row.startedAt),timeZone,rows:[],elapsedSeconds:0};groups.set(key,group)}group.rows.push(row);group.elapsedSeconds+=row.elapsedSeconds}
 const result=[...groups.values()];if(!preserveOrder)result.sort((a,b)=>b.key.localeCompare(a.key));return result.map(g=>({...g,rows:preserveOrder?g.rows.slice():g.rows.slice().sort((a,b)=>b.startedAt-a.startedAt||b.endedAt-a.endedAt||a.id.localeCompare(b.id))}));
}
export function exportSnapshotKey(text){const value=JSON.parse(text);delete value.exportedAt;return JSON.stringify(value)}
export function exportDescription(text,{formatDate=n=>new Date(n).toISOString()}={}){
 const d=JSON.parse(text),rows=d.history;if(!Array.isArray(rows))throw Error('INVALID_EXPORT');const times=rows.map(r=>r.startedAt);return `${rows.length}条练习记录${times.length?'，开始时间范围：'+formatDate(Math.min(...times))+'至'+formatDate(Math.max(...times)):''}。包括当前外观、声音及记录开关设置；${d.activeSession?'包含未结束的进度':'没有未结束进度'}；${d.unsavedCount||0}条尚未保存的本页记录。文件仅下载到本机，不上传；下载后请妥善保管。`;
}
