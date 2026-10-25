# Recovery inventory: what exists and what is still missing

This public inventory describes categories only. Full operational receipts, integrity manifests and resource configuration remain in the owner's protected local backup. No private paths, production identifiers, binding values, credentials or user data are included here.

| Material | Actual recovery state | Public GitHub state | Important limitation |
| --- | --- | --- | --- |
| Original TypeScript/React source project | Not recovered | Not uploaded | A deployed bundle is not the original project; no claim of full original-source reconstruction. |
| Deployed backend Worker | Raw multipart export and extracted executable module backed up locally with integrity checks | Excluded | Contains bundled dependencies; redistribution clearance is incomplete. Restore only through separately authorized official access and private verification. |
| Original source maps | Referenced by bundle, not present in recovered exports | Not available | No embedded original sources were established. Do not claim reverse compilation recovered the original project. |
| Known public frontend JavaScript and CSS | Downloaded and locally formatted/analyzed; known paths and hashes recorded privately | Old compiled files excluded | Recovered output can inform compatibility work, but is not the original frontend source tree. |
| Known public icon and SVG resources | Backed up locally with integrity checks | Old assets excluded | This is a known subset, not a complete remote static-asset export. |
| Complete production asset manifest | Unknown / not obtained | Not available | Do not replace the remote collection with the recovered subset. |
| Runtime/binding structure and rollback evidence | Privately backed up and compared | Redacted summaries only | Structure is not a secret export or a backup of business data. |
| Production database and Durable Object data | Not exported by this recovery work | Not uploaded | Code-version rollback does not restore database or object data. No schema or lifecycle migration is authorized here. |
| New home and integration candidate | Prepared locally; compatibility wrapper and tests available | Original router, release checks and synthetic tests committed | Whole candidate has not passed final production acceptance. Existing old execution bundle remains a protected local compatibility dependency. |

The repository contains public engineering source and test evidence, not a complete frontend/backend backup. Rights remain file-specific under the root COPYRIGHT.md. Do not commit a private compatibility bundle merely to make this directory look self-contained. A clean clone can run the synthetic unit tests without the old bundle; a faithful full local app requires separately authorized protected dependency recovery and complete configuration knowledge.

## Operational evidence boundary

Missing readback metadata is unknown, not proof that a configuration is disabled. An explicitly returned raw value is a reported value; its effective routing semantics must be established independently. Isolated candidate requests must prove they reached the intended candidate rather than silently falling back. HTTP 200 alone is insufficient.

An initial controlled request batch retained only status, selected response headers, length, hash and marker booleans. It did not save HTML bodies. Therefore the later observed response-hash mismatch cannot be explained offline as encoding, dynamic markup or platform injection: none of those causes was established. A subsequent HTML-diff read was rejected by the remote server with HTTP 403. It was stopped without retry, and original-only default traffic was restored and verified privately. No alternative network, identity or browser was used to bypass it.
