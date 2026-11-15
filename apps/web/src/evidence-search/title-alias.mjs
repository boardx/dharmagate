/** Verified bibliographic alias only; never translate or rewrite source text. */
export function withHeartSutraTitleAlias(service){
 return Object.freeze({...service,async search(input){
   const alias=typeof input?.query==='string'&&input.query.trim()==='心经';
   const result=await service.search(alias?{...input,query:'心經'}:input);
   return alias&&result.ok?{...result,query:input.query,titleAliasMatched:{input:'心经',canonical:'心經',editionId:'T08n0251',kind:'bibliographic-title-alias',sourceTextChanged:false}}:result;
 }});
}
