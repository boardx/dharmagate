# Round 01: protect old applications and integrate the new home

2026-10-25. Engineering checkpoint, **blocked before a successful release; completed deployment rounds: 0/10**.

Baseline design commit: `2445188a8fdcb5703f99b6253eb3da4d1ec00e51`. The product, architecture, UIUX and 45-item backlog were reviewed. All 45 items have parent-maintained GitHub Issues and a [ten-iteration mapping](../iterations-10.md); this file deliberately does not duplicate that mapping. Issue links: [DG-001 #1](https://github.com/boardx/dharmagate/issues/1), [DG-002 #2](https://github.com/boardx/dharmagate/issues/2), [DG-003 #3](https://github.com/boardx/dharmagate/issues/3), [DG-004 #4](https://github.com/boardx/dharmagate/issues/4), [DG-005 #5](https://github.com/boardx/dharmagate/issues/5). All five remain open; the first four are the focus, with partial DG-005 isolation work. None is marked fully complete by this checkpoint.

## User value and implementation

One site should offer the new BodhiWeave home while retaining old applications, locale entry points, authentication callbacks and static resources. The original bundle is kept privately as a byte-identical compatibility dependency. Public source contains an injectable router and synthetic tests, plus an offline release acceptance helper. It does not include the original bundle or any confidential runtime configuration.

The router handles document GET/HEAD requests at `/`, `/bodi`, `/bodi/`. All other requests preserve Request/env/ctx identity when forwarded. Root mutations and RSC navigation remain on the old Worker. Tests cover old application paths, auth callbacks, unknown paths, methods and delegation identity. This is a compatibility contract, not proof of real authentication, AI inference, email, payment or realtime-media behavior.

The release gate distinguishes missing routing fields (unknown), explicitly matching values (reported_match) and explicitly conflicting values (reported_conflict). A raw readback value alone is not treated as proof of effective edge routing. Acceptance requires verified field semantics or independently verified isolated-candidate behavior, as well as unchanged resources/runtime, clean package and current baseline evidence. It rejects evidence for another version, stale baseline, resource/lifecycle drift and local contamination. No upload function is included. Nine synthetic test groups pass; none establishes a production deployment.


## Release checkpoint

A previous upload was accepted but its raw routing readback conflicted with the requested configuration. Safety rollback was performed. Later controlled testing of the existing candidate at zero default traffic returned candidate-specific home content and working old public entry points, despite the raw routing value. Therefore the earlier claim that configuration definitively did not take effect was stronger than the evidence.

Default traffic stayed on the original version. The candidate response hash differed from local expected HTML; no body was retained in the initial test receipt. A follow-up read for HTML comparison received remote HTTP 403 and was stopped without retry or bypass. Original-only traffic was restored and verified. This is not a successful release; count remains 0/10, Issues remain open, and real authentication/AI/business operations remain untested. Operational identifiers and full receipts are kept privately, not published here.

See [recovery inventory](../../../apps/web/RECOVERY-INVENTORY.md) for which old artifacts exist, what is absent and what is intentionally excluded from public GitHub.

## Official deployment research and exact blocker

1. [Worker upload schema](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/) permits `assets.config.run_worker_first`, optional completion JWT and `keep_assets`. It does not explicitly promise a config-only override while retaining an old asset collection. The observed request was accepted but did not change the returned routing field.
2. [Multipart metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/) describes asset retention but no exact source-version selector or override guarantee. After rollback, latest uploaded version and active version differ; never assume those identities are interchangeable.
3. [Settings PATCH](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/edit/) and [combined settings PATCH](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/script_and_version_settings/methods/edit/) do not expose the asset-routing field in their documented request schemas. No undocumented patch is proposed.
4. [Version upload](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/) creates an undeployed candidate, a safer acceptance gate once the retain-assets method is established. Merely switching to this endpoint does not prove a fix; no alternative upload was attempted.
5. [Standard direct assets upload](https://developers.cloudflare.com/workers/static-assets/direct-upload/) registers the intended manifest, uploads missing hashes and uses completion JWT with config. Known recovered public files are not a verified complete manifest. Uploading them could lose unknown original assets and is blocked.

Installed official Wrangler 4.152.0 serializer independently places `run_worker_first` in `assets.config` and emits `keep_assets`; this confirms nesting, not backend semantics. The [official version-override smoke path](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/) allowed testing an existing candidate at zero default traffic without reuploading assets. Candidate-specific HTML was observed, but final equivalence remains unverified. Version URLs are not assumed available for Workers implementing Durable Objects; lifecycle compatibility and version-override behavior require separate checks. Further blocked reads must not be retried without materially new relevant evidence. A complete asset export remains necessary before any replacement-asset proposal. No support message has been sent, no DNS workaround proposed, no new project/account/domain created.

## Next release acceptance sequence

After the response-equivalence and access-evidence gaps are resolved: re-read active baseline and resource structure; prepare only code plus the three explicit routing rules; preserve all original assets, headers, bindings, runtime and lifecycle. Prefer safe inspection of an existing candidate where applicable. Inspect actual returned resources and classify readback uncertainty separately from behavior; verify candidate-specific response identity without assuming a preview URL. Stop on drift, API warnings or access denial. Only then deploy the reviewed candidate, anonymously verify new home and old routes/static hashes, and record rollback availability. A version rollback cannot restore business data.

Existing temporary credentials must not be renewed or replaced automatically. Missing complete asset inventory, any new permissions/resources/fees or database migration remain explicit blockers. No secret or binding value belongs in these records.
