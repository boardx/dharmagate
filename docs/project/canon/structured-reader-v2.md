# Complex TEI model: preparation only

This build-time module preserves parsed XML structure. It is not connected to the website reader and does not change catalogue eligibility. `productionReady`, `humanProofread` and `flattenedBody` must remain false; the verifier rejects altered flags and schema.

`tools/canon/structured_reader.py` exposes `convert(raw_bytes, expected_sha256)` and `verify(raw_bytes, model)`. Inputs must be provided explicitly by a caller. There is no network access, automatic corpus discovery, database access or default private path. Tests use entirely synthetic XML.

Run `python3 -m unittest discover -s tools/canon -p test_structured_reader.py` from the repository root, or run the portable content test command.

Local evidence on 2026-11-08 (Asia/Shanghai): 99 existing licensed CBETA XML units passed independent parsed-node/text/tail/attribute/path verification; all 99 persisted models passed re-verification. The checks covered 751,293 nodes, 676,876 text/tail slots and 233,541 source line/volume events. Original input hashes were unchanged. This is structural preservation, not word alignment, source-byte offsets, human proofreading or publication approval.

Only pure code and synthetic fixtures are published. The real XML, derived model files, private audit scripts and SAT directory response data are excluded. Original raw XML remains the authority for comments, processing instructions, entity spelling and lexical formatting.

Before activating a new reader: validate an actual model renderer, paginate without losing provenance, visually check glyphs/variants/figures and language layers, and publish a separately versioned catalogue/model set with readback and rollback. No new production-readable units are claimed by this change.
