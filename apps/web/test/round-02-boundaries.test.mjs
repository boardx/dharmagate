import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, storageKey } from '../src/catalog-model.mjs';
import { createIdentityBoundary } from '../src/identity-boundary.mjs';
import { evaluateRights, createRightsGuard, validatePilotManifest, purposes } from '../src/rights-policy.mjs';

// Entirely synthetic objects. No historical text, real account or legal grant is represented.
const digest = 'a'.repeat(64);
function catalog() {
  return {
    sources:[{id:'synthetic-source',sourceUrl:'https://example.invalid/source'}],
    works:[{id:'work-one',title:'Synthetic work',author:null,date:null}],
    editions:['a','b'].map(x=>({id:`edition-${x}`,workId:'work-one',sourceId:'synthetic-source',contentVersion:'v1',language:x==='a'?'zh':'en',translator:null})),
    assets:['a','b'].map(x=>({id:`asset-${x}`,editionId:`edition-${x}`,sourceId:'synthetic-source',contentVersion:'v1',sha256:digest})),
    fragments:['a','b'].map(x=>({id:`fragment-${x}`,assetId:`asset-${x}`,editionId:`edition-${x}`,contentVersion:'v1',assetSha256:digest,locator:{kind:'paragraph',value:'p1'}})),
  };
}
function grant(assetId='synthetic-asset') {
  return {assetId,sourceId:'synthetic-source',editionId:'synthetic-edition',status:'approved',rightsVersion:1,
    expiresAt:null,evidence:{snapshotSha256:digest,reviewedBy:'synthetic-reviewer'},
    permissions:Object.fromEntries(purposes.map(p=>[p,'allowed']))};
}

test('two synthetic editions keep independent fragment lineage and unknown authors/dates', () => {
  const data=catalog(); assert.equal(validateCatalog(data),true);
  assert.notEqual(data.fragments[0].editionId,data.fragments[1].editionId);
  assert.equal(data.works[0].author,null);assert.equal(data.works[0].date,null);
});
test('rejects mismatched asset hash, edition, content version and missing stable locator', () => {
  for(const mutate of [x=>x.fragments[0].assetSha256='b'.repeat(64),x=>x.fragments[0].editionId='edition-b',x=>x.fragments[0].contentVersion='v2',x=>x.fragments[0].locator={kind:'timecode',start:5,end:2},x=>x.assets[0].sourceId='other']) {
    const data=catalog();mutate(data);assert.throws(()=>validateCatalog(data),TypeError);
  }
});
test('private immutable object keys separate derivatives and reject path traversal', () => {
  const input={tenantId:'synthetic-tenant',sourceId:'synthetic-source',assetId:'synthetic-asset',contentVersion:'v1',kind:'original',sha256:digest};
  const key=storageKey(input);assert.ok(key.startsWith('private/'));
  assert.notEqual(storageKey({...input,kind:'ocr'}),key);
  assert.notEqual(storageKey({...input,contentVersion:'v2'}),key);
  assert.throws(()=>storageKey({...input,tenantId:'../other'}));
  assert.throws(()=>storageKey({...input,kind:'public'}));
});
test('server legacy session adapter isolates two accounts and tenants; editor cannot approve', async () => {
  const memberships={alice:{subjectId:'alice',tenantId:'t1',role:'editor'},bob:{subjectId:'bob',tenantId:'t1',role:'member'},reviewer:{subjectId:'reviewer',tenantId:'t1',role:'reviewer'}};
  // Map synthetic Request objects to a trusted server session result; no header authentication.
  const sessions=new WeakMap();
  const boundary=createIdentityBoundary({readLegacySession:req=>sessions.get(req),lookupMembership:(user,tenant)=>tenant==='t1'?memberships[user]:null});
  async function principal(user,tenant='t1'){const request=new Request('https://example.invalid/');sessions.set(request,{user:{id:user},expires:'2099-01-01T00:00:00Z'});return boundary.resolve(request,tenant);}
  const alice=await principal('alice'),bob=await principal('bob'),reviewer=await principal('reviewer');
  const privateNote={ownerId:'alice',tenantId:'t1'};
  assert.equal(boundary.canReadPrivate(alice,privateNote),true);
  assert.equal(boundary.canReadPrivate(bob,privateNote),false);
  assert.equal(boundary.canReadPrivate(reviewer,privateNote),false);
  assert.equal(boundary.canReadPrivate(alice,{...privateNote,tenantId:'t2'}),false);
  assert.equal((await principal('alice','t2')).authenticated,false);
  assert.equal(boundary.canApprovePublication(alice,{tenantId:'t1',submittedBy:'bob'}),false);
  assert.equal(boundary.canApprovePublication(reviewer,{tenantId:'t1',submittedBy:'alice'}),true);
  assert.equal(boundary.canApprovePublication(reviewer,{tenantId:'t1',submittedBy:'reviewer'}),false);
});
test('forged request claims, fabricated principal, expired and absent sessions fail closed', async () => {
  const boundary=createIdentityBoundary({readLegacySession:()=>null,lookupMembership:()=>{throw Error('should not look up');}});
  const p=await boundary.resolve(new Request('https://example.invalid/',{headers:{'X-User':'alice','X-Role':'reviewer'}}),'t1');
  assert.equal(p.authenticated,false);
  assert.equal(boundary.canReadPrivate({subjectId:'alice',tenantId:'t1',expires:Infinity},{ownerId:'alice',tenantId:'t1'}),false);
  const expired=createIdentityBoundary({readLegacySession:()=>({user:{id:'alice'},expires:'2000-01-01T00:00:00Z'}),lookupMembership:()=>null});
  assert.equal((await expired.resolve(new Request('https://example.invalid/'),'t1')).authenticated,false);
});
test('purpose-specific unknown/denied/conditional/revoked/expired permissions block use', () => {
  for(const purpose of purposes) {
    for(const status of ['unknown','denied','conditional']) {const row=grant();row.permissions[purpose]=status;assert.equal(evaluateRights(row,purpose).allowed,false);}
  }
  for(const mutate of [r=>r.status='revoked',r=>r.expiresAt='2000-01-01T00:00:00Z',r=>r.expiresAt='invalid',r=>r.evidence={},r=>r.rightsVersion=0]) {
    const row=grant();mutate(row);assert.equal(evaluateRights(row,'public_display').allowed,false);
  }
  assert.equal(evaluateRights(undefined,'download').allowed,false);
  assert.equal(evaluateRights(grant(),'unregistered-purpose').allowed,false);
});
test('current authoritative withdrawal blocks old links, stale search results and cached answers', async () => {
  const rows=new Map([['synthetic-asset',grant()]]);
  const guard=createRightsGuard({ledger:{getCurrent:id=>rows.get(id)}});
  for(const path of ['old-link','stale-search-index','old-answer-cache']) {
    assert.equal(await guard.read({assetIds:['synthetic-asset'],purpose:'public_display'},()=>path),path);
  }
  rows.set('synthetic-asset',{...grant(),rightsVersion:2,status:'revoked'});
  let loads=0;
  for(const path of ['old-link','stale-search-index','old-answer-cache'])
    await assert.rejects(guard.read({assetIds:['synthetic-asset'],purpose:'public_display'},()=>{loads++;return path;}),/CONTENT_NOT_AVAILABLE/);
  assert.equal(loads,0);
});
test('rights update during loading, hidden dependency and ledger failure cannot leak result', async () => {
  let row=grant();const guard=createRightsGuard({ledger:{getCurrent:()=>row}});
  await assert.rejects(guard.read({assetIds:['synthetic-asset'],purpose:'rag_quote'},()=>{row={...row,status:'revoked',rightsVersion:2};return 'must not return';}),/CONTENT_NOT_AVAILABLE/);
  await assert.rejects(guard.read({assetIds:[],purpose:'rag_quote'},()=> 'must not return'),/CONTENT_NOT_AVAILABLE/);
  const missing=createRightsGuard({ledger:{getCurrent:()=>null}});
  await assert.rejects(missing.read({assetIds:['unknown'],purpose:'download'},()=> 'must not return'),/CONTENT_NOT_AVAILABLE/);
  const failed=createRightsGuard({ledger:{getCurrent:()=>{throw Error('offline');}}});
  await assert.rejects(failed.read({assetIds:['synthetic-asset'],purpose:'public_display'},()=> 'must not return'));
});
test('pilot gate enforces one source, 10–30 unique licensed items; no real corpus approved', () => {
  assert.equal(validatePilotManifest([]),false);
  const records=Array.from({length:10},(_,i)=>grant(`synthetic-${i}`));
  assert.equal(validatePilotManifest(records),true); // Synthetic rule test, not rights clearance.
  assert.equal(validatePilotManifest(records.slice(1)),false);
  assert.equal(validatePilotManifest([...records,{...records[0]}]),false);
  assert.equal(validatePilotManifest(records.map((r,i)=>i? r:{...r,sourceId:'other'})),false);
  assert.equal(validatePilotManifest(records.map((r,i)=>i? r:{...r,status:'unknown'})),false);
});
