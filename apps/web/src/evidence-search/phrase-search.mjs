import {createEvidenceSearch,sourceFingerprint,sha256,EvidenceSearchError} from './index.mjs';
import {withHeartSutraTitleAlias} from './title-alias.mjs';
export const PHRASE_SCOPE=Object.freeze({unit:'T08n0251',commit:'8ebac86d00719479db5777dc6cd77ba111c3067a',sourceSHA256:'f5507df86309f861ef2b92e9ba9db985c6db0ad357553599c6e921e15deca761',readingSHA256:'08b143928370a910c6e5fdc5fb4b20dbf5e807d112be47f25e9a865e45ba1daf'});
export const foldPhrase=value=>String(value).normalize('NFC').replace(/[\p{P}\p{White_Space}]/gu,'');
const alias={query:'远离颠倒梦想',target:'遠離顛倒夢想',line:'T08n0251:0848c15'};
export function createPhraseSearch({records,readCurrent,authorizeRequest,revision,scope=PHRASE_SCOPE}={}){
 if(!Array.isArray(records)||records.length>20000||typeof readCurrent!=='function'||typeof authorizeRequest!=='function')throw Error('EXPLICIT_SOURCE_DEPENDENCIES_REQUIRED');
 const snapshots=structuredClone(records),fingerprints=snapshots.map(sourceFingerprint);
 const aliasAdmitted=scope.unit===PHRASE_SCOPE.unit&&scope.commit===PHRASE_SCOPE.commit&&scope.sourceSHA256===PHRASE_SCOPE.sourceSHA256&&scope.readingSHA256===PHRASE_SCOPE.readingSHA256&&snapshots.some(r=>r.editionId===alias.line.split(':')[0]&&r.segmentId===alias.line&&r.sourceCommit===scope.commit&&r.sourceSha256===scope.sourceSHA256&&r.text.includes(alias.target));
 const repository=Object.freeze({revision,readCurrent,scopedRetrieval:true,async lexical({query,filters,limit,isEligible,signal}){
  if(typeof isEligible!=='function')throw Error('SCOPE_FILTER_REQUIRED');
  const phrase=foldPhrase(aliasAdmitted&&query.trim()===alias.query?alias.target:query),hits=[];
  if(Array.from(phrase).length<2)throw new EvidenceSearchError(400,'INVALID_QUERY');
  for(let n=0;n<snapshots.length;n++){
   if(signal?.aborted)throw Error('QUERY_ABORTED');const r=snapshots[n],sourceFingerprint=await fingerprints[n],handle={editionId:r.editionId,segmentId:r.segmentId,sourceFingerprint};
   if(!await isEligible(handle))continue;
   if(Object.entries(filters).some(([key,value])=>r[key]!==value))continue;
   if(await sha256(r.text)!==r.segmentSha256)throw Error('INDEX_CONTENT_CHANGED');
   if(foldPhrase(r.text).includes(phrase)||foldPhrase(r.title).includes(phrase))hits.push({...handle,score:1});
  }
  return hits.sort((a,b)=>a.segmentId.localeCompare(b.segmentId)).slice(0,limit);
 }});
 const underlying=withHeartSutraTitleAlias(createEvidenceSearch({enabled:true,repository,authorizeRequest}));
 return Object.freeze({...underlying,async search(input){const response=await underlying.search(input);return response.ok?{...response,matchPolicy:'punctuation-folded-contiguous-phrase',semanticQualityAccepted:false,normalizationNotice:'连续原句限同一已索引原版行；匹配时忽略标点和空白，不跨行拼接，原文、出处与哈希均不转换。',queryAliasMatched:aliasAdmitted&&input.query.trim()===alias.query&&response.items.some(item=>item.citation.segmentId===alias.line)?{input:alias.query,sourcePhrase:alias.target,sourceLine:alias.line,ruleOwner:'Dharmagate; not a publisher-supplied alias',scope:'本站检索规则；仅此已核原句，不是完整简繁转换或AI翻译',sourceTextChanged:false}:null}:response;}});
}
