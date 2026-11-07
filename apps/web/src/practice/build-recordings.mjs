/** Build only the three individually reviewed public recordings. Never discovers local archives. */
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../public/practice-audio/',import.meta.url),manifestURL=new URL('licenses.json',root);
const expected=Object.freeze([
 {id:'recorded-bowl-struck',file:'55f8b4c1884a-bowl-struck.mp3',bytes:212690,sha256:'55f8b4c1884a740b6db2c536d85b2e7ced87701d5b3797be41483181abf9d875',license:'PD-self',author:'BambooBeast',source:'https://commons.wikimedia.org/wiki/File:SingingBowl1.ogg'},
 {id:'recorded-bowl-rubbed',file:'3447f2a1ef8a-bowl-rubbed.mp3',bytes:153349,sha256:'3447f2a1ef8acc29aef602598d60abfcc71d81308914af6f102fcee4281ed22b',license:'PD-self',author:'BambooBeast',source:'https://commons.wikimedia.org/wiki/File:SingingBowl2.ogg'},
 {id:'recorded-mokugyo',file:'1d9ff7584363-mokugyo.mp3',bytes:35798,sha256:'1d9ff75843635b1d5cc1b3e446e6e350eaa65faa33a2423dbd42bd5e75124cc9',license:'CC0-1.0',author:'jonopodmore',source:'https://freesound.org/people/jonopodmore/sounds/607215/'}
]);
const stat=await lstat(manifestURL);if(!stat.isFile()||stat.isSymbolicLink())throw Error('RECORDING_MANIFEST_NOT_REGULAR');
const manifestBytes=await readFile(manifestURL);
if(createHash('sha256').update(manifestBytes).digest('hex')!=='55f798a16a52b772a896601a0e0147d89fb888d6dc7c29084ecacf746c8cd024')throw Error('RECORDING_MANIFEST_CHANGED_REVIEW_REQUIRED');
const publicManifest=JSON.parse(manifestBytes.toString('utf8'));
if(publicManifest.schemaVersion!==1||Object.keys(publicManifest).some(k=>!['schemaVersion','recordings','notice'].includes(k))||!Array.isArray(publicManifest.recordings)||publicManifest.recordings.length!==expected.length)throw Error('RECORDING_MANIFEST_SCHEMA');
const allowed=['id','file','mediaUrl','source','downloadURL','author','license','licenseURL','licenseVerified','sourceDeclaration','bytes','sha256','mime','changes','auditionVerified'];
const urlHosts=new Set(['commons.wikimedia.org','upload.wikimedia.org','freesound.org','cdn.freesound.org','creativecommons.org']);
const output={};
for(let i=0;i<expected.length;i++){
 const item=publicManifest.recordings[i],known=expected[i];
 if(!item||Object.keys(item).some(k=>!allowed.includes(k))||allowed.some(k=>!Object.hasOwn(item,k)))throw Error('RECORDING_FIELDS');
 for(const [key,value]of Object.entries(known))if(item[key]!==value)throw Error('RECORDING_NOT_EXPLICITLY_REVIEWED_'+key);
 if(item.licenseVerified!==true||item.auditionVerified!==false||item.mime!=='audio/mpeg'||item.mediaUrl!=='/practice/audio/'+known.file)throw Error('RECORDING_METADATA');
 for(const key of ['source','downloadURL','licenseURL']){const url=new URL(item[key]);if(url.protocol!=='https:'||!urlHosts.has(url.hostname)||url.username||url.password)throw Error('RECORDING_SOURCE_URL');}
 for(const key of ['sourceDeclaration','changes'])if(typeof item[key]!=='string'||item[key].length>500||/[\u0000-\u001f]/.test(item[key]))throw Error('RECORDING_DESCRIPTION');
 const fileURL=new URL(known.file,root),fileStat=await lstat(fileURL);if(!fileStat.isFile()||fileStat.isSymbolicLink())throw Error('RECORDING_NOT_REGULAR');
 const bytes=await readFile(fileURL);if(bytes.length!==known.bytes||createHash('sha256').update(bytes).digest('hex')!==known.sha256)throw Error('RECORDING_BYTES_MISMATCH');
 if(!(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224))throw Error('RECORDING_NOT_MP3');
 output[item.mediaUrl]={id:item.id,bytes:item.bytes,sha256:item.sha256,mime:item.mime,base64:bytes.toString('base64')};
}
const generated='// Generated only from the explicit reviewed public recording manifest.\nexport const recordingAssets=Object.freeze('+JSON.stringify(output)+');\nexport const recordingLicenses='+JSON.stringify(publicManifest)+';\n';
if(process.argv.slice(2).some(arg=>arg!=='--check'))throw Error('UNSUPPORTED_BUILD_ARGUMENT');
const generatedURL=new URL('recordings.generated.mjs',import.meta.url);if(process.argv.includes('--check')){if(await readFile(generatedURL,'utf8')!==generated)throw Error('RECORDING_MODULE_STALE')}else await writeFile(generatedURL,generated);
console.log(JSON.stringify({recordings:expected.length,bytes:expected.reduce((n,x)=>n+x.bytes,0),ids:expected.map(x=>x.id),humanAuditionVerified:false}));
