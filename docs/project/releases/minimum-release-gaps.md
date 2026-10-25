# Minimum release gaps after R01/R02 preparation

Scope: existing project only. No new R03 placeholder feature. Verified release count remains **0/10**, and Issues remain open. This is a readiness assessment, not a deployment instruction or authorization for new resources, credentials or database changes.

## Separate the two release thresholds

| Threshold | Evidence available | Actual remaining gap |
| --- | --- | --- |
| R01: new home plus existing legacy applications | Original legacy compatibility dependency retained privately; original bindings and lifecycle compared; isolated route contracts pass; controlled zero-default-traffic candidate requests showed unique new-home content and known old public entries/static resources. | Candidate HTML response hash differs from local expected HTML and the initial probe did not retain the response body. A later diff read was blocked; it must not be retried or bypassed without applicable new evidence and authorization. No final accepted candidate/anonymous-default rollout receipt exists. Real login and business operations were not tested. |
| R02: model/identity/rights foundation actually serving users | Original code and offline negative tests exist for edition lineage, private object paths, injected legacy identity and current-rights guards. | These modules are not wired to deployed endpoints. Real server identity resolver, authoritative membership/rights persistence, real R2 checksum/access tests and independently cleared pilot corpus are missing. Synthetic passing tests cannot fill those gaps. |

R01 can be reviewed as a narrow home-and-compatibility change without claiming R02 is live. A complete first text-learning product additionally depends on the later search, evidence, reader and feedback items in the authoritative ten-round plan; it cannot be declared complete from R02 contracts.

## Existing identity and persistence reuse: evidence versus assumptions

- The protected bundle exposes the legacy fetch entry and existing Durable Object classes, not a separately exported authentication helper. Delegating unchanged old routes can preserve their original login behavior; directly importing an old auth helper into the new module has not been established.
- Compiled declarations show authentication-related user/account/session structures, but those declarations are not a live schema audit and no account records were queried. Session read endpoints may rotate or touch sessions; do not assume a GET is free of business writes.
- The existing database binding can remain unchanged. It does not prove that tenant memberships, per-purpose grants, rights versions or approval/audit structures exist. No new tables, migration or alternate persistence workaround has been performed.
- Existing Durable Objects are kept as compatibility dependencies. Do not repurpose live room/session objects as an unreviewed rights ledger or trigger them just to test new interfaces.
- A complete remote static-asset manifest remains unknown. Keep the existing collection; do not substitute the partial recovered folder. No new bucket, queue, model service or paid resource has been provisioned.

## Concrete next work, in dependency order

1. Resolve the R01 response-evidence gap using an allowed path, preserve the verified default legacy state, and review a candidate-specific acceptance record. A raw routing readback field or HTTP 200 is insufficient alone. No security protection may be weakened to obtain the record.
2. Before an R02 integration, identify a trusted server-side adapter for the existing login and a safe non-production two-account test path. Preserve real identities and their existing store; do not migrate accounts or trust client role headers.
3. Reconcile the required model/rights interfaces with an authorized schema-only persistence review. If suitable existing structures are absent, prepare a migration/resource proposal for review; do not execute it or overload unrelated fields silently.
4. Obtain real, item-specific source/permission evidence for one source and the bounded pilot corpus. Until then the real manifest stays empty and all new content-use actions remain denied.
5. Wire new routes behind real server identity and authoritative current-rights checks, then validate withdrawn old links/index/cache paths and cross-account access using approved test data. Only after those gates can a production release be considered and counted.

All production identifiers, sensitive configuration, full operational records, compatibility bundles and user data stay outside this public report. See [recovery inventory](../../../apps/web/RECOVERY-INVENTORY.md), [R01 checkpoint](round-01-engineering.md), [R02 checkpoint](round-02-engineering.md) and the [authoritative iteration plan](../iterations-10.md).
