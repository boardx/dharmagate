/** Explicitly injected, local-only practice data. No account, network, free text or audio behavior. */
import {SOUND_IDS,ACTIVE_SOUND_IDS,CUE_IDS,LEGACY_SOUND_IDS,LEGACY_CUE_IDS} from './sound-catalogue.mjs';
export const PRACTICE_STORAGE_KEY='dharmagate.practice.v1';
const VERSION=6,MAX_HISTORY=500,MAX_STORED_CHARACTERS=300000;
const DEFAULTS={minutes:20,preparationSeconds:10,intervalMinutes:0,theme:'paper',sound:'silent',volume:9,muted:false,bellEnabled:false,startCue:'silent',intervalCue:'silent',endCue:'recorded-bowl-struck',historyBrowse:{period:'all',outcome:'all',duration:'all',sound:'all',sort:'newest',page:1},sections:{timerSettings:true,progressLegend:false,historyFilters:false,evidence:false,modernThree:false,modernFive:false,cueEvents:false}};
const sessionKeys=['id','startedAt','endedAt','plannedSeconds','elapsedSeconds','outcome','practiceId','sound'];
const activeKeys=['id','startedAt','plannedSeconds','elapsedSeconds','preparationSeconds','intervalMinutes','practiceId','sound','state','updatedAt','cuePlan','legacyCuePlan','preparationRemainingMs','legacyPreparation'];
const clone=value=>structuredClone(value);
const fail=code=>{throw new TypeError(code)};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const keys=(value,allowed,required=allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key))&&required.every(key=>Object.hasOwn(value,key));
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const timestamp=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=8640000000000000;
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const seconds=value=>integer(value,0,10800);
const practice=value=>['open-listening','quiet-sitting'].includes(value);
const legacySounds=['silent','brown','rain','bell'];
const sound=(value,version=VERSION)=>(version>=6?SOUND_IDS:version===5?LEGACY_SOUND_IDS:legacySounds).includes(value);
const selectedSound=(value,version=VERSION)=>version>=6?ACTIVE_SOUND_IDS.includes(value):sound(value,version);
const retireAudio=p=>({...p,sound:'silent',bellEnabled:false,startCue:'silent',intervalCue:'silent',endCue:'silent'});
const retiredAudioWarning='旧版本的合成声音已停用；历史记录保留。当前声音与三个提示已改为无声，请重新选择真实录音；未自动改写原数据。';
const legacyCues=['silent','soft-bell','deep-bell','wood'];
const cue=(value,version=VERSION)=>(version>=6?CUE_IDS:version===5?LEGACY_CUE_IDS:legacyCues).includes(value);
function preferences(value,partial=false,version=VERSION){
 const allowed=Object.keys(DEFAULTS).filter(k=>!(version<4&&['historyBrowse','sections'].includes(k))&&!(version===1&&['startCue','intervalCue','endCue'].includes(k)));
 if(!keys(value,allowed,partial?[]:allowed))fail('INVALID_PREFERENCES');
 const validators={minutes:v=>integer(v,1,180),preparationSeconds:v=>[0,10,30].includes(v),intervalMinutes:v=>integer(v,0,180),theme:v=>['paper','white','night'].includes(v),sound:v=>version===1?['brown','rain','bell'].includes(v):selectedSound(v,version),volume:v=>integer(v,0,100),muted:v=>typeof v==='boolean',bellEnabled:v=>typeof v==='boolean',startCue:v=>cue(v,version),intervalCue:v=>cue(v,version),endCue:v=>cue(v,version),historyBrowse:v=>keys(v,['period','outcome','duration','sound','sort','page'])&&['all','today','7d','30d'].includes(v.period)&&['all','completed','ended','interrupted'].includes(v.outcome)&&['all','short','medium','long'].includes(v.duration)&&(v.sound==='all'||sound(v.sound,version))&&['newest','oldest','longest'].includes(v.sort)&&integer(v.page,1,25),sections:v=>keys(v,Object.keys(DEFAULTS.sections))&&Object.values(v).every(x=>typeof x==='boolean')};
 for(const key of Object.keys(value))if(!validators[key](value[key]))fail('INVALID_PREFERENCES');
 return clone(value);
}
function session(value,version=VERSION){
 if(![1,2,3,4,5,6].includes(version))fail('INVALID_VERSION');
 if(!keys(value,sessionKeys)||!identifier(value.id)||!timestamp(value.startedAt)||!timestamp(value.endedAt)||value.endedAt<value.startedAt||!integer(value.plannedSeconds,1,10800)||!seconds(value.elapsedSeconds)||value.elapsedSeconds>value.plannedSeconds||(value.outcome==='completed'&&value.elapsedSeconds!==value.plannedSeconds)||!['completed','ended','interrupted'].includes(value.outcome)||!practice(value.practiceId)||!sound(value.sound,version))fail('INVALID_SESSION');
 return clone(value);
}
function active(value,legacy=false,version=VERSION){
 if(![1,2,3,4,5,6].includes(version))fail('INVALID_VERSION');
 if(value===null)return null;
 if(legacy&&object(value)){if(!Object.hasOwn(value,'cuePlan')&&!Object.hasOwn(value,'legacyCuePlan'))value={...value,cuePlan:{startCue:'silent',intervalCue:'silent',endCue:'silent'},legacyCuePlan:true};if(!Object.hasOwn(value,'preparationRemainingMs')&&!Object.hasOwn(value,'legacyPreparation'))value={...value,preparationRemainingMs:0,legacyPreparation:true}}
 if(!keys(value,activeKeys,activeKeys.filter(k=>!['legacyCuePlan','legacyPreparation'].includes(k)))||!keys(value.cuePlan,['startCue','intervalCue','endCue'])||!Object.values(value.cuePlan).every(v=>cue(v,version))||(Object.hasOwn(value,'legacyCuePlan')&&typeof value.legacyCuePlan!=='boolean')||(value.legacyCuePlan===true&&Object.values(value.cuePlan).some(v=>v!=='silent'))||!integer(value.preparationRemainingMs,0,value.preparationSeconds*1000)||(value.preparationRemainingMs>0&&value.elapsedSeconds!==0)||(Object.hasOwn(value,'legacyPreparation')&&typeof value.legacyPreparation!=='boolean')||(value.legacyPreparation===true&&value.preparationRemainingMs!==0)||!identifier(value.id)||!timestamp(value.startedAt)||!timestamp(value.updatedAt)||value.updatedAt<value.startedAt||!integer(value.plannedSeconds,60,10800)||value.plannedSeconds%60!==0||!seconds(value.elapsedSeconds)||value.elapsedSeconds>=value.plannedSeconds||![0,10,30].includes(value.preparationSeconds)||!integer(value.intervalMinutes,0,180)||!practice(value.practiceId)||!selectedSound(value.sound,version)||!['running','paused'].includes(value.state))fail('INVALID_ACTIVE_SESSION');
 return clone(value);
}
function normalizeHistory(rows,version=VERSION){
 if(!Array.isArray(rows))fail('INVALID_HISTORY');
 const validated=rows.map(row=>session(row,version)).sort((a,b)=>b.endedAt-a.endedAt||a.id.localeCompare(b.id,'en'));
 const byId=new Map();for(const row of validated)if(!byId.has(row.id))byId.set(row.id,row);const unique=[...byId.values()];
 // Keep one record per id; a replay never creates a second history entry.
 return {history:unique.slice(0,MAX_HISTORY),truncated:unique.length>MAX_HISTORY,duplicates:unique.length!==rows.length};
}
export function createPracticeStore({storage,now=Date.now}={}){
 if(typeof now!=='function')fail('INVALID_CLOCK');
 const freshData=()=>({preferences:clone(DEFAULTS),history:[],remember:true,recordHistory:true,activeSession:null,truncated:false});
 let data=freshData();
 let handle=null,available=false,warning=null,protectedData=false,protectedRaw=null,conflict=false,lastRaw,observed=false;
 try{if(storage&&typeof storage.getItem==='function'&&typeof storage.setItem==='function'){handle=storage;available=true}}catch{/* Unavailable capabilities remain local memory only. */}
 if(!handle)warning='本机储存不可用；修改仅保留在当前页面，刷新后会丢失。';
 else{
  let raw;
  try{raw=handle.getItem(PRACTICE_STORAGE_KEY);if(raw===undefined)raw=null;lastRaw=raw;observed=true}catch{available=false;warning='无法读取本机储存；本次使用内存数据，尚未保存。'}
  if(raw!==null&&raw!==undefined&&available){
   try{
    if(typeof raw!=='string'||raw.length>MAX_STORED_CHARACTERS)fail('INVALID_STORED_DATA');
    const parsed=JSON.parse(raw),allowed=['version','preferences','history','remember','recordHistory','activeSession','truncated'];
    if(!keys(parsed,allowed,['version','history','remember','recordHistory','truncated'])||![1,2,3,4,5,VERSION].includes(parsed.version)||typeof parsed.remember!=='boolean'||typeof parsed.recordHistory!=='boolean'||typeof parsed.truncated!=='boolean')fail('INVALID_STORED_DATA');
    if(parsed.remember&&!Object.hasOwn(parsed,'preferences'))fail('INVALID_STORED_DATA');if(parsed.recordHistory&&!Object.hasOwn(parsed,'activeSession'))fail('INVALID_STORED_DATA');
    let prefs=Object.hasOwn(parsed,'preferences')?migratePracticePreferences(parsed.preferences,parsed.version):clone(DEFAULTS),records=normalizeHistory(parsed.history,parsed.version),checkpoint=Object.hasOwn(parsed,'activeSession')?active(parsed.activeSession,parsed.version<3,parsed.version):null;
    if(parsed.version<6){prefs=retireAudio(prefs);if(checkpoint)checkpoint={...checkpoint,sound:'silent',cuePlan:{startCue:'silent',intervalCue:'silent',endCue:'silent'},legacyCuePlan:true}}
    data={preferences:parsed.remember?prefs:retireAudio(clone(DEFAULTS)),history:records.history,remember:parsed.remember,recordHistory:parsed.recordHistory,activeSession:parsed.recordHistory?checkpoint:null,truncated:parsed.truncated||records.truncated};
    const notices=[];if(parsed.version<6)notices.push(retiredAudioWarning);if(!parsed.recordHistory&&checkpoint)notices.push('历史记录已关闭；已忽略旧活动进度，尚未自动改写本机数据。');else if(records.duplicates)notices.push('本机历史中重复的记录ID已去重，尚未自动改写原数据。');warning=notices.length?notices.join(' '):null;
   }catch{protectedData=true;protectedRaw=typeof raw==='string'?raw:null;available=false;warning='本机数据无法安全读取（格式损坏、版本不支持或字段无效）；原数据已受保护。普通操作仅留在内存，请先本地备份再明确重置。'}
  }
 }
 function read(){return clone({...data,available,protectedData,conflict,warning:warning||(data.truncated?'历史仅保留最近500条；更早记录已截断。':null)})}
 function payload(value=data){const stored={version:VERSION,remember:value.remember,recordHistory:value.recordHistory,history:value.history,truncated:value.truncated};if(value.recordHistory)stored.activeSession=value.activeSession;if(value.remember)stored.preferences=value.preferences;return stored}
 function markConflict(){conflict=true;available=false;warning='另一个页面已修改本机数据；此次修改仅保留内存，未覆盖本机记录。请刷新后重试，或先导出本页数据。';return false}
 // This detects observed stale snapshots; it is not an atomic cross-process compare-and-swap.
 function canWrite(allowProtected=false){
  if(conflict||(!allowProtected&&protectedData))return false;
  if(!handle){available=false;warning='本机储存不可用；此次修改未保存，仅在当前页面可用。';return false}
  let current;try{current=handle.getItem(PRACTICE_STORAGE_KEY);if(current===undefined)current=null}catch{available=false;warning='保存前无法核对本机数据；未写入，仅在当前页面可用。';return false}
  if(!observed||current!==lastRaw)return markConflict();
  return true;
 }
 function persist(failureDetail='此次修改未保存，仅在当前页面可用。'){
  if(!canWrite())return read();
  try{const encoded=JSON.stringify(payload());handle.setItem(PRACTICE_STORAGE_KEY,encoded);lastRaw=encoded;available=true;warning=null}
  catch(error){available=false;warning=(error?.name==='QuotaExceededError'?'本机储存空间不足；':'无法保存至本机；')+failureDetail}
  return read();
 }

 return {
  read,
  // Raw bytes are returned only on an explicit call, for a user-initiated local backup of protected data.
  rawBackup(){return protectedData?protectedRaw:null},
  resetProtectedData(){
   if(!protectedData||!canWrite(true))return read();
   const next=freshData();
   try{const encoded=JSON.stringify(payload(next));handle.setItem(PRACTICE_STORAGE_KEY,encoded);lastRaw=encoded;data=next;protectedData=false;protectedRaw=null;available=true;warning=null}
   catch{available=false;warning='显式重置未保存；原始本机数据仍受保护，请先备份或检查储存权限。'}
   return read();
  },
  resetPreferences(){data.preferences=clone(DEFAULTS);return data.remember?persist():read()},
  restoreBackup({records=[],settings=null,isCurrent=()=>true}={}){
   if(typeof isCurrent!=='function'||!Array.isArray(records)||records.length>MAX_HISTORY)fail('INVALID_BACKUP_COMMIT');
   const additions=records.map(row=>session(row)),prefs=settings===null?null:preferences(settings),next=clone(data),byId=new Map(next.history.map(r=>[r.id,r]));
   for(const r of additions){if(byId.has(r.id)){if(practiceSessionKey(byId.get(r.id))!==practiceSessionKey(r))fail('BACKUP_ID_CONFLICT')}else byId.set(r.id,r)}
   if(byId.size>MAX_HISTORY)fail('BACKUP_CAPACITY');if(prefs&&next.activeSession)fail('BACKUP_SETTINGS_ACTIVE');
   next.history=normalizeHistory([...byId.values()]).history;if(prefs)next.preferences=prefs;
   if(!isCurrent())return {...read(),restoreResult:{status:'cancelled',changed:false}};if(protectedData||conflict)return {...read(),restoreResult:{status:'refused',changed:false}};
   const changed=JSON.stringify(next)!==JSON.stringify(data);if(!changed)return {...read(),restoreResult:{status:'committed',changed:false,scope:handle?'storage':'memory-only'}};
   if(!handle){if(!isCurrent())return {...read(),restoreResult:{status:'cancelled',changed:false}};data=next;available=false;warning='恢复仅保留在本页内存，未写入本机储存。';return {...read(),restoreResult:{status:'committed',changed:true,scope:'memory-only'}}}
   if(!canWrite())return {...read(),restoreResult:{status:'refused',changed:false}};if(!isCurrent())return {...read(),restoreResult:{status:'cancelled',changed:false}};const encoded=JSON.stringify(payload(next));if(encoded.length>MAX_STORED_CHARACTERS)fail('BACKUP_CAPACITY');if(!isCurrent())return {...read(),restoreResult:{status:'cancelled',changed:false}};
   try{handle.setItem(PRACTICE_STORAGE_KEY,encoded);lastRaw=encoded;data=next;available=true;warning=null}catch{available=false;warning='恢复未保存；原本机数据未被替换，请保留备份并重试。';return {...read(),restoreResult:{status:'failed',changed:false}}}return {...read(),restoreResult:{status:'committed',changed:true,scope:'storage'}};
  },
  setPreferences(patch){const next=preferences(patch,true);data.preferences={...data.preferences,...next};return data.remember?persist():read()},
  setRemember(value){if(typeof value!=='boolean')fail('INVALID_REMEMBER');data.remember=value;return persist(value?'此次修改未保存，仅在当前页面可用。':'关闭记忆未保存，旧偏好可能仍在本机。')},
  setHistoryEnabled(value){if(typeof value!=='boolean')fail('INVALID_HISTORY_SETTING');data.recordHistory=value;return persist(value?undefined:'关闭历史记录未保存，旧活动进度可能仍在本机。')},
  setActiveSession(record){data.activeSession=active(record);return data.recordHistory?persist(record===null?'结束进度未保存，旧进度可能仍在本机。':undefined):read()},
  addSession(record){
   const row=session(record),already=data.history.some(item=>item.id===row.id);let changed=false;
   if(data.activeSession?.id===row.id){data.activeSession=null;changed=true}
   if(data.recordHistory&&!already){const normalized=normalizeHistory([...data.history,row]);data.history=normalized.history;data.truncated=data.truncated||normalized.truncated;changed=true}
   return changed&&data.recordHistory?persist():read();
  },
  deleteSession(id){if(!identifier(id))fail('INVALID_SESSION_ID');const next=data.history.filter(row=>row.id!==id);if(next.length===data.history.length)return read();data.history=next;return persist('删除记录未保存，该记录可能仍在本机。')},
  clearHistory(){data.history=[];data.truncated=false;return persist('清除历史未保存，已有记录可能仍在本机。')},
  // History opt-out keeps a checkpoint in RAM only; even explicit export omits that RAM-only checkpoint.
  exportData(){const exportedAt=now();if(!timestamp(exportedAt))fail('INVALID_CLOCK');return JSON.stringify({version:VERSION,exportedAt,...clone(data),activeSession:data.recordHistory?clone(data.activeSession):null})}
 };
}

// Shared strict validators for local backup parsing; no second permissive schema.
export const validatePracticeSession=session;
export const validatePracticeActive=active;
export function validatePracticePreferences(value,{version=VERSION}={}){if(![1,2,3,4,5,6].includes(version))fail('INVALID_VERSION');return preferences(value,false,version)}
export function migratePracticePreferences(value,version){const p={...clone(DEFAULTS),...validatePracticePreferences(value,{version})};return version<6?retireAudio(p):p}
export function defaultPracticePreferences(){return clone(DEFAULTS)}

export function practiceSessionKey(value){const r=session(value);return JSON.stringify(sessionKeys.map(k=>r[k]))}
