# Round 01: protect old applications and integrate the new home

2026-10-25. Engineering checkpoint, **blocked before a successful release; completed deployment rounds: 0/10**.

Baseline design commit: `2445188a8fdcb5703f99b6253eb3da4d1ec00e51`. The product, architecture, UIUX and 45-item backlog were reviewed. All 45 items are to be linked to parent-maintained GitHub Issues and ten iterations; this file deliberately does not duplicate that mapping. Issue links: [DG-001 #1](https://github.com/boardx/dharmagate/issues/1), [DG-002 #2](https://github.com/boardx/dharmagate/issues/2), [DG-003 #3](https://github.com/boardx/dharmagate/issues/3), [DG-004 #4](https://github.com/boardx/dharmagate/issues/4), [DG-005 #5](https://github.com/boardx/dharmagate/issues/5). All five remain open; the first four are the focus, with partial DG-005 isolation work. None is marked fully complete by this checkpoint.

## User value and implementation

One site should offer the new BodhiWeave home while retaining old applications, locale entry points, authentication callbacks and static resources. The original bundle is kept privately as a byte-identical compatibility dependency. Public source contains an injectable router and synthetic tests, plus an offline release acceptance helper. It does not include the original bundle or any confidential runtime configuration.

The router handles document GET/HEAD requests at `/`, `/bodi`, `/bodi/`. All other requests preserve Request/env/ctx identity when forwarded. Root mutations and RSC navigation remain on the old Worker. Tests cover old application paths, auth callbacks, unknown paths, methods and delegation identity. This is a compatibility contract, not proof of real authentication, AI inference, email, payment or realtime-media behavior.

The release gate rejects the observed failure class: an HTTP-successful upload whose version runtime still reports `raw_run_worker_first: false`. It also rejects evidence for another version, stale production baseline after rollback, binding/resource drift, DO lifecycle changes, altered runtime/headers, local database/migration/secret contamination, unverified retained asset identity and an unsupported routing update method. No upload function is included.

## Release checkpoint

A previous upload was accepted but did not satisfy asset-routing configuration acceptance. It was safely rolled back and verified using private operational receipts. Those receipts, version identifiers and runtime inventory are not published here. That attempt does not count as a completed iteration. No further production upload has been made for this checkpoint. Historical verification is not a fresh health check.

The first-round implementation is locally tested but remains blocked from release. It does not prove real authentication, AI inference or other business operations.

## Official deployment research and exact blocker

1. [Worker upload schema](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/) permits `assets.config.run_worker_first`, optional completion JWT and `keep_assets`. It does not explicitly promise a config-only override while retaining an old asset collection. The observed request was accepted but did not change the returned routing field.
2. [Multipart metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/) describes asset retention but no exact source-version selector or override guarantee. After rollback, latest uploaded version and active version differ; never assume those identities are interchangeable.
3. [Settings PATCH](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/settings/methods/edit/) and [combined settings PATCH](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/script_and_version_settings/methods/edit/) do not expose the asset-routing field in their documented request schemas. No undocumented patch is proposed.
4. [Version upload](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/) creates an undeployed candidate, a safer acceptance gate once the retain-assets method is established. Merely switching to this endpoint does not prove a fix; no alternative upload was attempted.
5. [Standard direct assets upload](https://developers.cloudflare.com/workers/static-assets/direct-upload/) registers the intended manifest, uploads missing hashes and uses completion JWT with config. Known recovered public files are not a verified complete manifest. Uploading them could lose unknown original assets and is blocked.

Installed official Wrangler 4.152.0 serializer independently places `run_worker_first` in `assets.config` and emits `keep_assets`; this confirms nesting, not backend semantics. No reliable supported exact-preservation routing update was established. Next step is authoritative Cloudflare clarification, or an official complete asset export/manifest. No support message has been sent, no DNS workaround proposed, no new project/account/domain created.

## Next release acceptance sequence

After the blocker is resolved with evidence: re-read active baseline and resource structure; prepare only code plus the three explicit routing rules; preserve all original assets, headers, bindings, runtime and lifecycle. Create an undeployed version if supported for the verified method, inspect its actual returned runtime and resources, and stop before deployment if any mismatch. Only then deploy the reviewed candidate, anonymously verify new home and old routes/static hashes, and record rollback availability. A version rollback cannot restore business data.

Existing temporary credentials must not be renewed or replaced automatically. Missing complete asset inventory, any new permissions/resources/fees or database migration remain explicit blockers. No secret or binding value belongs in these records.
