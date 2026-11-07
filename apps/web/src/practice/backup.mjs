/** Pure local backup parsing and review. No file, storage, network or execution capabilities. */
import {validatePracticeSession,validatePracticeActive,migratePracticePreferences,practiceSessionKey} from './persistence.mjs';
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fields=['version','exportedAt','preferences','history','remember','recordHistory','activeSession','truncated','unsavedCount'];
export function parsePracticeBackup(text){
 if(typeof text!=='string'||text.length>300000||new TextEncoder().encode(text).length>512000)throw TypeError('BACKUP_SIZE');
 let d;try{d=JSON.parse(text)}catch{throw TypeError('BACKUP_JSON')}
 if(!plain(d)||Object.keys(d).some(k=>!fields.includes(k))||fields.filter(k=>k!=='unsavedCount').some(k=>!Object.hasOwn(d,k))||![1,2,3,4,5,6,7].includes(d.version)||!Number.isFinite(d.exportedAt)||d.exportedAt<0||d.exportedAt>8640000000000000||typeof d.remember!=='boolean'||typeof d.recordHistory!=='boolean'||typeof d.truncated!=='boolean'||!Array.isArray(d.history)||d.history.length>500||Object.hasOwn(d,'unsavedCount')&&(!Number.isInteger(d.unsavedCount)||d.unsavedCount<0||d.unsavedCount>500))throw TypeError('BACKUP_SCHEMA');
 const preferences=migratePracticePreferences(d.preferences,d.version);validatePracticeActive(d.activeSession,d.version<3,d.version);
 const unique=new Map(),conflictIds=new Set();let duplicateCount=0;
 for(const value of d.history){const r=validatePracticeSession(value,d.version);if(unique.has(r.id)){if(practiceSessionKey(unique.get(r.id))===practiceSessionKey(r))duplicateCount++;else conflictIds.add(r.id)}else unique.set(r.id,r)}
 return {sourceVersion:d.version,retiredAudio:d.version<6,preferences,history:[...unique.values()],conflictIds:[...conflictIds],duplicateCount,sourceCount:d.history.length,activeIgnored:d.activeSession!==null,unsavedIgnored:d.unsavedCount||0,truncated:d.truncated};
}
export function previewPracticeBackup(parsed,current){
 const byId=new Map(current.history.map(r=>[r.id,r])),internal=new Set(parsed.conflictIds),candidates=[];let duplicateCount=parsed.duplicateCount,conflictCount=internal.size;
 for(const r of parsed.history){if(internal.has(r.id))continue;const existing=byId.get(r.id);if(existing){if(practiceSessionKey(existing)===practiceSessionKey(r))duplicateCount++;else conflictCount++}else candidates.push(r)}
 const capacityRemaining=Math.max(0,500-byId.size),records=candidates.slice(0,capacityRemaining);
 return {records:structuredClone(records),settings:structuredClone(parsed.preferences),summary:{sourceVersion:parsed.sourceVersion,sourceCount:parsed.sourceCount,sourceTruncated:parsed.truncated,newCount:candidates.length,importableCount:records.length,duplicateCount,conflictCount,capacityRemaining,capacitySkipped:Math.max(0,candidates.length-records.length),newIds:candidates.map(r=>r.id),activeIgnored:parsed.activeIgnored,unsavedIgnored:parsed.unsavedIgnored,retiredAudio:parsed.retiredAudio===true,warning:(parsed.retiredAudio?'旧备份的合成声音已停用；仅恢复无声设置，不会替换为其他录音。 ':'')+'未在当前库中的ID可能是曾删除的记录；仅在明确选择后恢复。原有记录保留，不覆盖同ID冲突。'}};
}
