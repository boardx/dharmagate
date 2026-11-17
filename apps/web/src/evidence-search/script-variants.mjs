import {foldPhrase,PHRASE_SCOPE} from './phrase-search.mjs';
export const QUERY_VARIANTS=Object.freeze([
 Object.freeze({input:'观自在',sourcePhrase:'觀自在',sourceLine:'T08n0251:0848c06',labelId:'P2'}),
 Object.freeze({input:'色不异空',sourcePhrase:'色不異空',sourceLine:'T08n0251:0848c07',labelId:'V1'})
]);
/** These two whole-query rules are owned search aliases, NOT a character
 * converter, publisher assertion, translation, or grant of content rights.
 * Caller must use the already verified original source/reading model and the
 * existing authorization entry/exit wrapper. No source or quote is rewritten.
 */
export function createScriptVariantSearch({phrase,sourceLines,scope=PHRASE_SCOPE}={}){
 if(typeof phrase?.search!=='function'||!Array.isArray(sourceLines))throw Error('VERIFIED_PHRASE_SOURCE_REQUIRED');
 const pin=Object.freeze(structuredClone(scope)),lines=structuredClone(sourceLines),scopePinned=pin.unit===PHRASE_SCOPE.unit&&pin.commit===PHRASE_SCOPE.commit&&pin.sourceSHA256===PHRASE_SCOPE.sourceSHA256&&pin.readingSHA256===PHRASE_SCOPE.readingSHA256;
 const admitted=scopePinned?QUERY_VARIANTS.filter(rule=>lines.some(line=>line.id===rule.sourceLine&&line.text.includes(rule.sourcePhrase))):[];
 return Object.freeze({...phrase,async search(input){
  const normalized=typeof input?.query==='string'?foldPhrase(input.query):null,rule=admitted.find(rule=>rule.input===normalized),result=await phrase.search(rule?{...input,query:rule.sourcePhrase}:input);
  if(!result.ok)return result;
  const matching=rule&&result.items.some(item=>item.citation.segmentId===rule.sourceLine&&item.citation.sourceCommit===pin.commit&&item.citation.sourceSha256===pin.sourceSHA256);
  return {...result,query:input.query,normalizationNotice:(result.normalizationNotice??'')+'本候选新增有限整串别名：观自在、色不异空；不是通用简繁转换，不改原文。',...(matching?{queryAliasMatched:{input:input.query,normalizedInput:rule.input,sourcePhrase:rule.sourcePhrase,sourceLine:rule.sourceLine,sourceCommit:pin.commit,sourceSha256:pin.sourceSHA256,ruleOwner:'Dharmagate; not a publisher-supplied alias',scope:'仅折叠标点/空白后的整串查询；限当前固定版本与同一原版行；非通用简繁转换或AI翻译',sourceTextChanged:false}}:{})};
 }});
}
