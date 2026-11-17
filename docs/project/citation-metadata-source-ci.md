# Citation metadata source and CI scope

This application source change adds a separate optional `resolveCitationMetadata` method. Existing citation text and exact-quote validation keeps its current-version behavior; historical metadata never substitutes the current head or grants text, URLs, or reading rights.

The bridge implementation is owned application code with no imports or direct database, filesystem, or network access. Its explicitly injected current-authority, current-head, and version-metadata callbacks remain trusted integration boundaries. Metadata responses report `bytesVerified: false` and `rightsGranted: false`. Data-descriptor snapshots reject adapter accessors before the final authorization and index checks.

The R2 runtime metadata endpoint stays unavailable even if a bridge is supplied. A separate metadata registry and current authority have not been implemented. This endpoint rejects before any object read, fulltext search initialization, bridge invocation, or legacy fallback. The optional core method can only be exercised by an explicitly constructed service; it does not make runtime historical reading available.

The existing evidence-search workflow runs an explicit owned-source closure check and fourteen synthetic Node test files. The current local equivalent completed 110 assertions, including configured and unconfigured runtime storage-denial cases. This does not claim a new remote CI run, deployment, complete site build, or real archive acceptance. The earlier root CI document remains unchanged historical documentation; this note describes the current fourteen-suite candidate.

The complete isolated CI snapshot includes unchanged dependency inputs. Only the separately reviewed additive application, synthetic-test, workflow, closure-checker, and documentation delta is a publication candidate. It removes no existing business files. Publication-path and file-hash checks are necessary consistency checks; they do not authenticate external reviews or authorize deployment.
