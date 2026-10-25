import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRelease, landingPaths } from '../ops/release-gate.mjs';
function fixture() {
  const baseline = {version:'baseline-fixture',bindings:[{name:'TEST_DB',type:'d1',id:'test-only'}],migrationTag:'fixture-lifecycle',runtime:{compatibility_date:'2025-12-01'},assets:{raw_headers:'fixture-header'}};
  const candidate = structuredClone(baseline); candidate.version='candidate-fixture';
  candidate.assets.raw_run_worker_first=[...landingPaths];
  const evidence={source:'official-version-get',candidateVersion:candidate.version,activeBaselineVersion:baseline.version,retainedAssetCollectionVerified:true,supportedAssetRoutingMethod:true};
  return {baseline,candidate,evidence};
}
test('rejects the real failed-upload class: HTTP success with old asset routing', () => {
  const input=fixture(); input.candidate.assets.raw_run_worker_first=false;
  assert.equal(assessRelease(input).readyForDeployment,false);
});
test('requested metadata or evidence for another version cannot substitute for returned runtime', () => {
  const input=fixture(); input.evidence.source='upload-request';
  assert.equal(assessRelease(input).readyForDeployment,false);
  input.evidence.source='official-version-get'; input.evidence.candidateVersion='other';
  assert.equal(assessRelease(input).readyForDeployment,false);
});
test('rejects drift, resource loss, lifecycle changes and local release contamination', () => {
  const mutations=[x=>x.evidence.activeBaselineVersion='drift',x=>x.candidate.bindings=[],x=>x.candidate.migrationTag='changed-fixture-lifecycle',x=>x.candidate.runtime={},x=>x.candidate.assets.raw_headers='',x=>x.evidence.containsLocalDatabase=true,x=>x.evidence.containsSecrets=true,x=>x.evidence.containsMigrations=true,x=>x.evidence.retainedAssetCollectionVerified=false,x=>x.evidence.supportedAssetRoutingMethod=false];
  for(const mutate of mutations){const input=fixture();mutate(input);assert.equal(assessRelease(input).readyForDeployment,false);}
});
test('synthetic complete evidence exercises pass branch, not a production deployment receipt', () => {
  assert.equal(assessRelease(fixture()).readyForDeployment,true);
});
