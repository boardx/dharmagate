# Round 02: isolated model, identity and rights contracts

2026-10-25. **Code preparation only; R01 remains unreleased; completed release rounds 0/10.**

Read and mapped the formal open Issues: [#6 identity/tenant boundaries](https://github.com/boardx/dharmagate/issues/6), [#7 evidence model](https://github.com/boardx/dharmagate/issues/7), [#8 storage conventions](https://github.com/boardx/dharmagate/issues/8), [#9 rights ledger](https://github.com/boardx/dharmagate/issues/9), [#10 pilot corpus](https://github.com/boardx/dharmagate/issues/10), [#11 publication rights gate](https://github.com/boardx/dharmagate/issues/11). This checkpoint does not close them or change the authoritative iteration mapping.

## Concrete additions

- Edition-specific model validation with asset integrity and stable fragment lineage; unknown authors/dates remain unknown.
- Private immutable storage-key convention, without any R2 provisioning/upload.
- Injected existing-session identity adapter contract with authoritative tenant membership, owner-only private reads and reviewer/editor separation.
- Purpose-specific deny-by-default rights checks plus current-ledger checks before and after reads, including stale index and answer-cache read paths.
- Bounded pilot-manifest rule and an empty real-manifest template; no corpus or grant is approved.

See [module contracts and integration limits](../../../apps/web/ROUND-02-CONTRACTS.md). Tests cover two synthetic accounts, cross-tenant denial, forged/expired sessions, editor/self-review denial, edition/hash mismatch, unsafe paths, unknown/denied/conditional permissions, immediate synthetic withdrawal, stale caches and ledger failures. Synthetic identity/rights cases are not real login validation or licensing evidence.

## Validation and gaps

`npm test` in `apps/web` passes 18 test groups: 9 retained first-round groups and 9 new second-round groups. Environment is Node 22, offline, with no cloud/database/Durable Object calls. Source and test hashes are in the matching local test receipt. Source commit is recorded in the Git commit containing these files; it is not a deployed-source claim.

No production schema/user-data writes, identity replacement, migrations, new resource, permission, credential, paid service or deployment were performed for this round. No Stream. Full production session integration, durable authoritative rights ledger, real R2 checksum/access verification and item-level corpus clearance remain pending. Full P0 acceptance and production business behavior are unverified; R02 cannot count as a released iteration.

## Separate access diagnosis

The first exact-second query was not submitted because the UI did not retain seconds. A later separately authorized, host-filtered minimum-minute query returned one potentially matching security event. Detailed event/correlation evidence remains in protected operational records; original request-level correlation is incomplete. The denied public-home GET was not retried or bypassed, and no security settings, identities, IPs or credentials changed. This does not establish a Worker failure. See [minimum release gaps](minimum-release-gaps.md) for the current readiness assessment.
