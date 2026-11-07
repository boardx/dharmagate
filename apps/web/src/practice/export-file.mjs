/** Prepare an exact local JSON snapshot; never starts a download or sends data. */
export function preparePracticeExport(text,{Blob:BlobCtor=globalThis.Blob,URL:urls=globalThis.URL}={}){
 if(typeof text!=='string')throw TypeError('INVALID_EXPORT_TEXT');const d=JSON.parse(text);
 if(!Number.isFinite(d.exportedAt)||!Number.isFinite(new Date(d.exportedAt).getTime()))throw TypeError('INVALID_EXPORT_TIME');
 const filename='dharmagate-practice-'+new Date(d.exportedAt).toISOString().replace(/[:.]/g,'-')+'.json',bytes=new TextEncoder().encode(text).byteLength;
 let url=null,revoked=false;try{url=urls.createObjectURL(new BlobCtor([text],{type:'application/json'}))}catch{/* Copying the explicitly prepared text stays available. */}
 return{filename,bytes,url,revoke(){if(!revoked&&url){revoked=true;urls.revokeObjectURL(url)}}};
}
