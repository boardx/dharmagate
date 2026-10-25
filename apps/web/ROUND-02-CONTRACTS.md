# Round 02 contracts — code preparation only

Status: implementation preparation; not integrated with production routes. Round 01 is not released. All Issues remain open and the verified deployment count remains 0/10. See the parent-maintained [ten-round plan](../../docs/project/iterations-10.md).

## Model and storage boundary — #7, #8

`validateCatalog` validates a source → work → edition → asset → fragment graph. A work can have multiple editions; each fragment points to one specific edition, content version and exact asset hash, with paragraph/page/timecode locator. Unknown author/date/translator remain null. It rejects duplicate IDs, invalid lineage, mismatched hashes and invalid locators. This is an application-level schema contract, not SQL or a production migration.

`storageKey` provides immutable, hash-bearing private object-key conventions separated by original/normalized/OCR/transcript/thumbnail kind. It rejects unsafe path components. It does not create an R2 bucket, upload an object, change visibility or return a public URL. Real R2 upload checksum verification, object-policy enforcement and complete inventory remain unverified.

## Existing identity adapter — #6

`createIdentityBoundary` accepts `readLegacySession(request)` and `lookupMembership(subjectId, tenantId)`. Both must be trusted server-side adapters to the existing identity system and authoritative membership store. User/role headers and client JSON must never implement these adapters. No replacement login system, account migration or real-account fixture is supplied.

The resolver denies absent/expired sessions and mismatched tenant memberships. Issued principal objects are opaque to the boundary; fabricated plain objects cannot authorize private reads. Only the owner in the same tenant may read a private resource; reviewer status does not grant access to private notes. Editors cannot approve publication; an authorized reviewer cannot approve their own submission. Publication approval still requires the independent rights gate.

Actual legacy-session extraction/integration and two real test-account validation are pending. The deployed compatibility bundle does not imply its internal auth resolver is available as a reusable public export. No production endpoint calls this new module yet. These tests establish interface behavior, not complete identity-system security certification.

## Rights ledger and current-state checks — #9, #11

`evaluateRights` separates metadata indexing, original preservation, public display, download, derivation, RAG quotation, model training and redistribution. Each purpose requires an explicit allowed value on a reviewed, non-expired record. Unknown, denied and unresolved conditional permissions are denied; revoked/unapproved or missing evidence/version also deny. Technical structure checks do not establish legal permission.

`createRightsGuard` requires an authoritative `ledger.getCurrent(assetId)` adapter. Every read checks all server-derived source dependencies before loading and again before returning. The same guard must wrap old links, index hits and answer-cache hits; a stale cached grant cannot replace the current ledger. Changed permission version, missing dependency, revocation or ledger failure prevents content return. This module does not persist grants or replace the future authoritative database. Fresh membership and rights enforcement must remain server-side on every production path.

The authority adapter must provide consistency sufficient for immediate withdrawal; eventually consistent caches alone cannot satisfy that contract. Dependencies must be derived by trusted provenance, never accepted from the requesting browser. Persisted approval, audit, invalidation and resource-scoped access integration remain future implementation tasks. Concurrent/distributed production withdrawal behavior has not been tested.

## Pilot corpus — #10

`validatePilotManifest` checks the bounded one-source, 10–30 unique-item envelope and required use grants. Tests use explicitly synthetic grants to exercise the rule. **No real corpus or rights grant has been approved, copied or ingested.** The real manifest is intentionally empty until a source owner/editor supplies independently verifiable item-level licensing, versions and required use permissions. Synthetic pass results cannot authorize real materials or AI training.

## Test and deployment boundaries

Run `npm test` in this directory with Node 22+. The suite is offline, injects fake server sessions/memberships and an in-memory synthetic rights reader, and makes no cloud, email, AI, payment, database or Durable Object calls. No new Cloudflare product, paid compute or Cloudflare Stream is introduced. Real account integration, durable ledger, R2 validation, human rights clearance, negative tests against the deployed system and successful round-one deployment are still blockers.
