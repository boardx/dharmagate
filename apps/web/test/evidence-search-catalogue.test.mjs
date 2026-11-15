import test from 'node:test';import assert from 'node:assert/strict';
import {CANON_CATALOGUE,readCurrentCanonAdmission} from '../src/evidence-search/catalogue-rights.mjs';
test('current legacy catalogue key is explicit and source-reader-v2 hash changes fail closed',async()=>{
 const seen=[];await assert.rejects(readCurrentCanonAdmission({}, {id:'T08n0251'},async(_bucket,key,max)=>{seen.push({key,max});return new Uint8Array(CANON_CATALOGUE.bytes)}),/CURRENT_CATALOGUE_HASH_CHANGED/);
 assert.deepEqual(seen,[{key:'canon/8ebac86d00719479db5777dc6cd77ba111c3067a/source-catalogue-v2.json.gz',max:796116}]);
});
test('catalogue read failures are not replaced by active literal approval or cached authority',async()=>{
 let reads=0;for(let n=0;n<2;n++)await assert.rejects(readCurrentCanonAdmission({}, {id:'T08n0251'},async()=>{reads++;throw Error('missing catalogue')}),/missing catalogue/);assert.equal(reads,2);
});
