# Web application recovery and integration

This directory is the source home for the existing dharmagate-web project inside the single boardx/dharmagate repository. It is not a new Cloudflare project or a complete recovered original application.

`src/create-router.mjs` is commissioned integration code. It serves a supplied landing document on `/`, `/bodi`, `/bodi/` and delegates all other requests to an injected legacy Worker without changing request, bindings or execution context. Root mutations and React Server Component requests remain on the legacy implementation. Platform asset routing happens before this code: passing unit tests does not establish that the production platform will invoke it.

Run `npm test` here with Node 22+. Tests use synthetic data, no external packages, credentials, network calls, database or Durable Objects. `ops/release-gate.mjs` is an offline decision helper, not an uploader. Its input must be populated from reviewed, candidate-specific official API evidence. Tests of its pass branch are explicitly synthetic.

## Protected compatibility dependency

The old deployed Worker is retained only in the owner's protected local workspace. It is a deployment bundle, not original TypeScript/React source, and includes dependencies whose redistribution has not been cleared. Do not add it to this public repository. Private recovery records contain integrity checks and provenance; they are deliberately excluded here.

Recovery must use Cloudflare's official script download endpoints with separately approved temporary access. Save the export privately, validate paths before unpacking and verify integrity against the private baseline. Never extract browser cookies or copy credentials into Git. Keep the verified compatibility module under ignored `recovered/` only for an authorized local build. Preserve existing exports, resources and lifecycle; no migration is part of this work.

No production Wrangler config or deploy command is provided: the retain-assets routing issue is unresolved. In particular, do not deploy the prior local empty-database configuration, inferred SQL or local DO migrations. Do not replace the unknown full remote asset collection with the partially recovered local files. No Cloudflare Stream is used or planned.

## Publication and rights boundary

Only the original integration code, synthetic tests and redacted engineering records in this directory are submitted. No third-party full text, old minified bundle, production data, account/resource binding values or credentials are included. Repository-level COPYRIGHT.md remains authoritative; this addition does not relicense existing mixed research materials.

See [round-one engineering checkpoint](../../docs/project/releases/round-01-engineering.md). Parent-maintained Issues and iteration mapping remain the planning source of truth; this checkpoint does not mark any DG acceptance criteria complete.
