/** Cooperative Web Locks coordination only. No network, persistent tab identity or account access. */
import {createPracticeStore,PRACTICE_STORAGE_KEY} from './persistence.mjs';
import {parsePracticeBackup,previewPracticeBackup} from './backup.mjs';
const DATA_LOCK='dharmagate.practice.data',ACTIVE_LOCK='dharmagate.practice.active';
const clone=x=>structuredClone(x);
export function createPracticeCoordinator({storage,locks,now=Date.now}={}){
 const atomic=Boolean(locks&&typeof locks.request==='function'),listeners=new Set(),outbox=new Map(),outboxBases=new Map();
 let store=createPracticeStore({storage:atomic?storage:undefined,now}),snapshot=store.read(),activeOwned=false,releaseHold=null,acquiring=null,activeGeneration=0,lockWarning=null,outboxConflict=false,backupPreview=null,backupGeneration=0;
 // No-lock mode deliberately does not read or write durable storage.
 function read(){const d=clone(snapshot);if(outbox.size){const byId=new Map(d.history.map(r=>[r.id,r]));for(const r of outbox.values())if(!byId.has(r.id))byId.set(r.id,clone(r));d.history=[...byId.values()].sort((a,b)=>b.endedAt-a.endedAt||a.id.localeCompare(b.id,'en')).slice(0,500)}return {...d,atomicCoordination:atomic,activeOwned,unsavedCount:outbox.size,available:atomic&&d.available&&!outbox.size&&!lockWarning,warning:lockWarning||(outboxConflict?'本机数据已更新；待保存记录仅保留本页，为避免复活删除记录已停止重试，请导出。':!atomic?'此浏览器没有可用的跨页锁；本页仅使用内存，刷新后不会保存，也不保证跨页独占。':outbox.size?'有练习记录尚未保存，仅保留本页内存；可显式重试。':d.warning)}}
 function notify(){const d=read();for(const fn of listeners){try{fn(clone(d))}catch{/* Subscriber failures must not alter storage results. */}}return d}
 function fresh(){const next=createPracticeStore({storage,now}),d=next.read();
  // Keep transient opt-out values only when the latest durable flags still opt out.
  if(!d.remember)next.setPreferences(snapshot.preferences);
  if(!d.recordHistory&&activeOwned&&snapshot.activeSession)next.setActiveSession(snapshot.activeSession);
  if(d.protectedData&&snapshot.protectedData&&next.rawBackup()===store.rawBackup())return store;
  return next;
 }
 async function transaction(operation){
  if(!atomic){const result=operation(store);if(result&&typeof result.then==='function')await result;snapshot=store.read();return notify()}
  let entered=false;try{return await locks.request(DATA_LOCK,{mode:'exclusive'},async()=>{entered=true;lockWarning=null;store=fresh();const result=operation(store);if(result&&typeof result.then==='function')await result;snapshot=store.read();return notify()})}
  catch(error){if(entered){notify();throw error}lockWarning='跨页数据锁不可用；此次操作未写入，请稍后重试。';return notify()}
 }
 const methods={};for(const name of ['setPreferences','resetPreferences','setRemember','setHistoryEnabled','setActiveSession','deleteSession','clearHistory','resetProtectedData'])methods[name]=value=>transaction(s=>{
  if(name==='setActiveSession'&&!activeOwned)throw Error('ACTIVE_OWNERSHIP_REQUIRED');
  const result=s[name](value);
  // A spectator may disable recording but must not retain another page's checkpoint in RAM.
  if(name==='setHistoryEnabled'&&value===false&&!activeOwned)s.setActiveSession(null);
  // Explicit deletion also deletes this page's unsaved copy; no later retry resurrects it.
  if(name==='deleteSession'){outbox.delete(value);outboxBases.delete(value)}if(name==='clearHistory'){outbox.clear();outboxBases.clear();outboxConflict=false}
  if(name==='resetProtectedData'&&!result.protectedData&&!result.conflict&&result.available){outbox.clear();outboxBases.clear();outboxConflict=false}
 });
 function backupStateKey(s){const value=JSON.parse(s.exportData());delete value.exportedAt;return JSON.stringify({data:value,outbox:[...outbox.values()]})}
 function invalidateBackupPreview(id){if(id===undefined||backupPreview?.id===id){backupGeneration++;backupPreview=null}}
 async function previewBackup(text){const generation=++backupGeneration;backupPreview=null;const parsed=parsePracticeBackup(text);let response=null;const state=await transaction(s=>{if(generation!==backupGeneration)return;if(outbox.size){response={previewId:null,status:'refused',reason:'OUTBOX_PENDING'};return}if(s.read().protectedData||s.read().conflict||atomic&&!s.read().available){response={previewId:null,status:'refused',reason:'CURRENT_DATA_UNAVAILABLE'};return}const raw=atomic?storage.getItem(PRACTICE_STORAGE_KEY)??null:null,preview=previewPracticeBackup(parsed,s.read()),id='backup_'+generation;backupPreview={id,generation,parsed,raw,stateKey:backupStateKey(s)};response={previewId:id,status:'preview',summary:preview.summary,settings:preview.settings,defaults:{history:false,settings:false},scope:atomic?'storage':'memory-only'}});return response||{previewId:null,status:generation!==backupGeneration?'cancelled':'failed',warning:state.warning}}
 async function commitBackup(previewId,{history=false,settings=false,isCurrent=()=>true,...extra}={}){if(typeof history!=='boolean'||typeof settings!=='boolean'||typeof isCurrent!=='function'||Object.keys(extra).length)throw TypeError('INVALID_BACKUP_SELECTION');let outcome=null;const selected=backupPreview;const state=await transaction(s=>{const current=()=>backupPreview===selected&&selected?.id===previewId&&selected?.generation===backupGeneration&&isCurrent();if(!current()){outcome={status:'cancelled',changed:false};return}if(outbox.size){outcome={status:'refused',changed:false,reason:'OUTBOX_PENDING'};return}if(s.read().protectedData||s.read().conflict||atomic&&!s.read().available){outcome={status:'refused',changed:false,reason:'CURRENT_DATA_UNAVAILABLE'};return}const raw=atomic?storage.getItem(PRACTICE_STORAGE_KEY)??null:null;if(raw!==selected.raw||backupStateKey(s)!==selected.stateKey){outcome={status:'refused',changed:false,reason:'PREVIEW_STALE'};return}if(settings&&(activeOwned||s.read().activeSession||outbox.size)){outcome={status:'refused',changed:false,reason:'SETTINGS_ACTIVE'};return}if(!history&&!settings){outcome={status:'refused',changed:false,reason:'NOTHING_SELECTED'};return}const p=previewPracticeBackup(selected.parsed,s.read());const applied=s.restoreBackup({records:history?p.records:[],settings:settings?p.settings:null,isCurrent:current});outcome={...applied.restoreResult,importedCount:applied.restoreResult.status==='committed'&&history?p.records.length:0,settingsApplied:applied.restoreResult.status==='committed'&&settings,summary:p.summary};});if(backupPreview===selected)invalidateBackupPreview(previewId);return {...state,importResult:outcome||{status:'failed',changed:false,reason:'LOCK_UNAVAILABLE'}}}
 return {read,previewBackup,commitBackup,invalidateBackupPreview,subscribe(fn){if(typeof fn!=='function')throw TypeError('INVALID_SUBSCRIBER');listeners.add(fn);return()=>listeners.delete(fn)},...methods,
  async addSession(record){
   // Validate before entering a lock; never queue arbitrary/free-text records.
   createPracticeStore().addSession(record);
   let applied=false;try{const result=await transaction(s=>{applied=true;const before=s.read();if(atomic&&(!before.available||before.protectedData))return;const base=atomic?storage.getItem(PRACTICE_STORAGE_KEY)??null:null;const enabled=before.recordHistory,result=s.addSession(record);if(atomic&&enabled&&!result.available){outbox.set(record.id,clone(record));outboxBases.set(record.id,base)}else if(result.available||!enabled){outbox.delete(record.id);outboxBases.delete(record.id)}});if(!applied&&atomic)return notify();return result}
   catch(error){throw error}
  },
  async refresh(){let entered=false;const result=await transaction(()=>{entered=true});return {...result,refreshConfirmed:!atomic||entered}},
  retryUnsaved(){return transaction(s=>{if(!atomic||!outbox.size||!s.read().recordHistory||!s.read().available)return;const current=storage.getItem(PRACTICE_STORAGE_KEY)??null;if(outboxConflict||[...outbox.keys()].some(id=>outboxBases.get(id)!==current)){outboxConflict=true;return}for(const [id,r]of outbox){const result=s.addSession(r);if(!result.available)break;outbox.delete(id);outboxBases.delete(id);const saved=storage.getItem(PRACTICE_STORAGE_KEY)??null;for(const remaining of outbox.keys())outboxBases.set(remaining,saved)}})},
  exportData(){const d=JSON.parse(store.exportData());d.history=read().history;return JSON.stringify({...d,unsavedCount:outbox.size})},rawBackup(){return store.rawBackup()},
  acquireActive(){
   if(activeOwned)return Promise.resolve(true);if(acquiring)return acquiring;
   if(!atomic){activeOwned=true;notify();return Promise.resolve(true)}
   const generation=++activeGeneration;let resolveAcquired;
   acquiring=new Promise(resolve=>{resolveAcquired=resolve});const requested=acquiring;
   // Do not await the request promise here: its callback owns the lock until released.
   Promise.resolve().then(()=>locks.request(ACTIVE_LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock||generation!==activeGeneration){resolveAcquired(false);return}
    let resolveHold;const hold=new Promise(resolve=>{resolveHold=resolve});releaseHold=resolveHold;activeOwned=true;resolveAcquired(true);notify();await hold;
    if(generation===activeGeneration){activeOwned=false;releaseHold=null;notify()}
   })).catch(()=>{lockWarning='无法取得跨页练习锁；未接管其他页面的练习。';resolveAcquired(false);notify()}).finally(()=>{if(acquiring===requested)acquiring=null});
   return requested;
  },
  releaseActive(){activeGeneration++;activeOwned=false;const release=releaseHold;releaseHold=null;acquiring=null;if(release)release();notify()}
 };
}
