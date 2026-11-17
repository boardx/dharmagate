import {createPublicCanonSearch} from './canon-adapter.mjs';
import {sha256} from './index.mjs';

/** Existing storage adapter, no binding creation or implicit listings. One reviewed
 * edition only. Data and approval records remain runtime inputs, never public Git.
 */
export async function createStoredCanonSearch({edition,readObject,readApproval,citationMetadataBridge}={}) {
  if(edition?.id!=='T08n0251'||typeof readObject!=='function'||typeof readApproval!=='function')throw Error('EXPLICIT_REVIEWED_EDITION_REQUIRED');
  const pin=structuredClone(edition);
  const prefix='canon/'+pin.sourceCommit+'/'+pin.id+'/';
  if(!/^[a-f0-9]{40}$/.test(pin.sourceCommit)||!['sourceSha256','readingSha256','documentSha256'].every(k=>/^[a-f0-9]{64}$/.test(pin[k]))||pin.rawKey!==prefix+'source.xml'||!pin.documentKey?.startsWith(prefix)||pin.documentKey.includes('..')||pin.documentKey.length>240)throw Error('STORED_CANON_PINS_INVALID');
  async function bytes(key,max){const supplied=await readObject(key);if(!(supplied instanceof Uint8Array)||supplied.byteLength>max)throw Error('STORED_CANON_OBJECT_UNAVAILABLE');return supplied.slice();}
  const readRights=async()=>{
    const record=structuredClone(await readApproval({id:pin.id,sourceCommit:pin.sourceCommit,sourceSha256:pin.sourceSha256,readingSha256:pin.readingSha256}));
    if(record?.id!==pin.id||record.sourceCommit!==pin.sourceCommit||record.sourceSha256!==pin.sourceSha256||record.readingSha256!==pin.readingSha256||record.documentSha256!==pin.documentSha256||record.status!=='active'||record.literalIndex!==true||record.unchangedShortSnippet!==true||record.nonCommercial!==true||record.noticeAndVersionAccessible!==true||record.license!=='CC BY-NC-SA 4.0'||record.rag!==false||record.embedding!==false||record.training!==false||typeof record.revision!=='string'||!record.revision)throw Error('CURRENT_CANON_APPROVAL_DENIED');
    return {...record,public:true,display:true,search:true,publicationEligible:true};
  };
  await readRights();
  return createPublicCanonSearch({citationMetadataBridge,admissions:[{...pin,publicationEligible:true}],indexRevision:'literal:'+pin.sourceCommit+':'+pin.documentSha256,readRights,readVerifiedUnit:async()=>{
    const rawBytes=await bytes(pin.rawKey,32_000_000),jsonBytes=await bytes(pin.documentKey,4_000_000);
    if(await sha256(new TextDecoder('utf8',{fatal:true}).decode(jsonBytes))!==pin.documentSha256)throw Error('STORED_READING_DOCUMENT_HASH_MISMATCH');
    const document=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(jsonBytes));
    if(!document.sourceHeaderXml?.includes('Available for non-commercial use when distributed with this header intact.'))throw Error('ORIGINAL_PUBLICATION_NOTICE_REQUIRED');
    return {rawBytes,document};
  }});
}
