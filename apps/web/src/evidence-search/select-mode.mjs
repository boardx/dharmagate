export function selectSearchModes(keyword,phrase){
 return Object.freeze({...keyword,search(input){return input.mode==='phrase'?phrase.search({...input,mode:'keyword'}):keyword.search(input)}});
}
