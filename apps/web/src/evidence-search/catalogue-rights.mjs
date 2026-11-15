// Existing source-reader-v2 metadata pins, not a new authorization grant.
export const CANON_CATALOGUE=Object.freeze({key:'canon/8ebac86d00719479db5777dc6cd77ba111c3067a/source-catalogue-v2.json.gz',bytes:796116,sha256:'5f8f0cdd57b98642ffe4a5e3b0f09452ba6a4dba05531b76f08cd099923ad5b5',decodedBytes:3013321,decodedSha256:'b4dcdf9224d1865133d091db04c548b326652f9b63f6ea2aec9358fd3c08a067'});
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export async function readCurrentCanonAdmission(bucket,edition,readBounded){
 const bytes=await readBounded(bucket,CANON_CATALOGUE.key,CANON_CATALOGUE.bytes);
 if(bytes.length!==CANON_CATALOGUE.bytes||await digest(bytes)!==CANON_CATALOGUE.sha256)throw Error('CURRENT_CATALOGUE_HASH_CHANGED');
 const body=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 const decoded=await readBounded({get:async()=>({size:CANON_CATALOGUE.decodedBytes,body})},'',CANON_CATALOGUE.decodedBytes);
 if(await digest(decoded)!==CANON_CATALOGUE.decodedSha256)throw Error('CURRENT_CATALOGUE_DECODED_HASH_CHANGED');
 const catalogue=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(decoded));
 if(catalogue.commit!==edition.sourceCommit||!Array.isArray(catalogue.items)||catalogue.items.length!==4885)throw Error('CURRENT_CATALOGUE_VERSION_CHANGED');
 const rows=catalogue.items.filter(r=>r.id===edition.id),row=rows[0];
 if(rows.length!==1||row.rightsEligible!==true||row.publicationEligible!==true||row.rawSha256!==edition.sourceSha256||row.readingSha256!==edition.readingSha256||row.license!=='CC BY-NC-SA 4.0')throw Error('CURRENT_LEGACY_ADMISSION_DENIED');
 return CANON_CATALOGUE.sha256+':'+row.id+':'+row.rawSha256+':'+row.readingSha256;
}
