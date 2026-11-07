/** Static import lines used by owned browser modules. Does not execute source or inspect UI strings. */
export function ownedModuleImports(source){
 if(typeof source!=='string')throw TypeError('INVALID_MODULE_SOURCE');
 const imports=[];let block=false;
 for(let line of source.split(/\r?\n/)){
  line=line.trimStart();
  if(block){const end=line.indexOf('*/');if(end<0)continue;line=line.slice(end+2).trimStart();block=false}
  while(line.startsWith('/*')){const end=line.indexOf('*/',2);if(end<0){block=true;line='';break}line=line.slice(end+2).trimStart()}
  if(!line||line.startsWith('//'))continue;
  const match=line.match(/^import\b\s*(?:[^'";\n]+?\bfrom\s*)?(['"])([^'"]+)\1/);
  if(match)imports.push(match[2]);
 }
 return imports;
}
