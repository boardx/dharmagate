/** Offline acceptance only. This module has no upload or authentication capability. */
export const landingPaths = Object.freeze(['/', '/bodi', '/bodi/']);

export function assessRelease({ baseline, candidate, evidence }) {
  const failures = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (!baseline?.version || !candidate?.version || baseline.version === candidate.version)
    failures.push('A distinct candidate version and explicit baseline are required');
  if (evidence?.source !== 'official-version-get' || evidence?.candidateVersion !== candidate?.version)
    failures.push('Candidate-specific official GET evidence is required');
  if (evidence?.activeBaselineVersion !== baseline?.version)
    failures.push('Active production baseline must be rechecked after any rollback');
  if (!evidence?.retainedAssetCollectionVerified)
    failures.push('Full remote asset collection identity preservation is unverified');
  if (!same(candidate?.assets?.raw_run_worker_first, landingPaths))
    failures.push('Returned runtime must contain exact Worker-first paths, not requested metadata');
  if (!same(candidate?.bindings, baseline?.bindings))
    failures.push('Binding descriptors or resource identities changed');
  if (!same(candidate?.runtime, baseline?.runtime))
    failures.push('Non-asset runtime settings changed');
  if (!baseline?.migrationTag || candidate?.migrationTag !== baseline?.migrationTag)
    failures.push('Existing Durable Object lifecycle must remain intact');
  if (!same(candidate?.assets?.raw_headers, baseline?.assets?.raw_headers))
    failures.push('Existing asset headers changed');
  if (evidence?.containsLocalDatabase || evidence?.containsMigrations || evidence?.containsSecrets)
    failures.push('Local database, migrations or secrets must not enter the release package');
  if (!evidence?.supportedAssetRoutingMethod)
    failures.push('Supported retain-assets routing update method remains unresolved');
  return { readyForDeployment: failures.length === 0, failures };
}
