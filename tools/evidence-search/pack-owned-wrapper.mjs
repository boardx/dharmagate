import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),identifier=value=>typeof value==='string'&&/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
/** Pure explicit-buffer composition. This does not find, fetch, compile or
 * authorize a retained site. CI supplies only a tiny synthetic baseline/IIFE.
 */
export function packOwnedWrapper({baseline,ownerIIFE,expectedBaselineSHA256,expectedPrefixSHA256,baselineDefault,namespace,candidateDefault,relay,voice,descriptor}={}){
 if(!Buffer.isBuffer(baseline)||!Buffer.isBuffer(ownerIIFE)||![baselineDefault,namespace,candidateDefault,relay,voice].every(identifier))throw Error('EXPLICIT_BUFFERS_AND_IDENTIFIERS_REQUIRED');
 if(sha(baseline)!==expectedBaselineSHA256)throw Error('BASELINE_HASH_MISMATCH');
 const text=baseline.toString('utf8'),exportText=`export{${relay} as RealtimeRelay,${voice} as VoiceRoomDO,${baselineDefault} as default};`;
 if(!text.trimEnd().endsWith(exportText))throw Error('EXACT_EXPORT_SUFFIX_REQUIRED');
 const offset=text.lastIndexOf(exportText),prefix=baseline.subarray(0,Buffer.byteLength(text.slice(0,offset)));
 if(sha(prefix)!==expectedPrefixSHA256||text.includes(namespace)||text.includes(candidateDefault))throw Error('PREFIX_HASH_OR_NAMESPACE_INVALID');
 const json=JSON.stringify(descriptor);if(json===undefined)throw Error('EXPLICIT_JSON_DESCRIPTOR_REQUIRED');
 const suffix='\n'+ownerIIFE.toString('utf8')+'\nconst '+candidateDefault+'='+namespace+'.createFullCandidate('+baselineDefault+','+json+');\nexport{'+relay+' as RealtimeRelay,'+voice+' as VoiceRoomDO,'+candidateDefault+' as default};\n';
 return Object.freeze({artifact:Buffer.concat([prefix,Buffer.from(suffix)]),prefixBytes:prefix.length,prefixSHA256:sha(prefix)});
}
