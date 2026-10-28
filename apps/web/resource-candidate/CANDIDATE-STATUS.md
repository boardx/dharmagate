# Resource pipeline candidate status

This is owned source and tests for a disabled resource-management candidate, not a completed production release or reconstructed original application source.

## Implemented locally

- Server-side admin HTTP/page handlers, explicit HMAC-form default and optional strict same-origin JSON mode. The JSON option requires canonical HTTPS Origin, Fetch Metadata and a custom header; no production security mode is selected here.
- Independent read-only legacy DB-session resolver under a reviewed canonical contract pin; it never executes the legacy role-update helper. The real contract and old bundle are intentionally excluded. The wider session issuance chain still requires security review before enabling privileged features.
- Parameterized new-table-only D1 store, transactional audit and persistent idempotency.
- Eight additive tables; local SQLite importer checks original/normalized hashes, six purpose-specific permissions, non-AI derivative approval, UTF-8 chunk limits, private default and pilot acceptance.
- Fail-closed capacity checks: at most100 versions,50MiB logical content,32KiB chunks,75MiB allocated SQLite-page growth. These are pilot caps, not the long-term platform capacity.
- Keyword reading/search candidate has no AI, embeddings or durable index. It requires current display approval and publication review; upstream acquisition permission is not end-user download permission.

## Evidence boundaries

Local Node contract tests, in-memory/file SQLite concurrency tests and separate local workerd/D1 checks exist. The latter use artificial identities or reviewed local-only corpus copies; they are not real-account production acceptance. Ten pinned Pali original texts have been fetched and privately persisted locally with source/rights/hash evidence. No corpus bytes, real accounts, cookie values, credentials or database files are committed here.

The source's original-language public-domain statement and separate request to avoid generative-AI datasets are both preserved. RAG, embeddings and training remain denied for this pilot. No English translation permission is inferred.

## Production blockers and authorization

The user has approved owned GitHub sync, the target Worker release and the single target database's additive resource schema/data scope. Old pending-approval notes are historical, not a reason to repeat those questions.

Engineering/security gates remain: trustworthy end-to-end session issuance, real existing-account acceptance, a verified production CSRF choice, and a reliable production D1 physical-capacity/atomic import guarantee. D1's size_after is post-statement metadata; unsupported page-count pragmas cannot be bypassed. Production importer therefore still refuses. No new credentials, account permissions, security rules, old roles or paid services are implicitly authorized.

Production entry does not import/enable these modules. No production migration or corpus import has occurred. No Issue is closed and no new iteration is counted accepted.

Long-term architecture remains immutable originals/derivatives in R2 and catalog/rights in D1. D1-only text storage is a bounded temporary local pilot;1000 versions/1GiB is an expansion design, not an implemented migration or reason to lift the current cap.

## Reproduce dependency-free checks

From apps/web:

```
node --test test/*.test.mjs
python3 -m unittest discover -s resource-candidate -p 'test_*.py' -q
```

The private legacy-contract/full workerd checks are not part of this public dependency-free command. Do not manufacture a permissive identity fixture to claim those checks passed on a clean public checkout.


## Updated integration status — 2026-10-27

The eight additive resource tables and four indexes have now been created and read back in the approved database. No production text import has run. This publication proposal does not enable the admin router or authentication.

The historical database-session resolver is for the isolated recovery tests only: an old stored session and matching role do not establish email ownership. Weak legacy session issuance/readers are disabled in the separate protected release, and preserved old session rows must not be accepted by a future production resolver. Reliable ownership verification remains a separate integration requirement.

The newer first-ten post-commit capacity adapter and its local D1 tests are deliberately outside these twenty proposed files. The original production meter guard in this proposal remains closed; publishing these sources is not approval or implementation of a production data-import endpoint. Formal business acceptance remains incomplete.
