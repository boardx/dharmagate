# Buddhist video review — 2026-11-07

This review retains 100 unique YouTube full-upload / independent-episode links, prioritizes confirmed Chinese accessibility, and adds subtitle evidence, viewing order, prerequisites and selected chapter links.

## Research and changes

104 pages were inspected: the original 100 and four replacements. Publisher descriptions and subtitle menus were checked; decoded frames near 90% of each retained upload were sampled. Selected middle sections and four Chinese transcript samples were reviewed. This is not full listening of every recording or a comparison against every original master. A complete independent episode is distinguished from a complete series; planned silence and ceremonial tails are explained.

Replacements:

- XaBitGGkMBw → pHqfCKtSYrQ: replace an uploader-described recombination of 2–5 lectures with an identifiable Sheng Yen public lecture.
- JR8XN9Iv3kg → Jc95dQi8E6U: improve publisher and event traceability with Lien Yin Temple’s independently numbered dialogue, without alleging the old teaching was incorrect.
- vNf0Bty1C7I → hUKPkTFTHZk: use the Dalai Lama Chinese channel edition with observed burned-in Chinese subtitles.
- mRNmET5L2GM → FVQmzsZ3Zq8: replace an upload blocked in the audit browser’s country with CCTV’s complete Dunhuang episode 2. The regional restriction does not establish global removal.

Confirmed Chinese accessibility: 68 (52 Chinese originals, 5 publisher-described Chinese interpretation/guidance, 11 foreign originals with confirmed Chinese text). Another 21 Chinese-channel editions have unconfirmed audio accessibility; 11 foreign extensions have no confirmed Chinese accessibility. Chinese channel branding alone is not evidence of Chinese audio.

Confirmed Chinese captions: 44 (10 selectable uploaded Chinese tracks and 34 observed burned-in Chinese editions). Uploaded does not guarantee human authorship; burned-in coverage was not verified line by line. Automatic translation is not counted as an uploaded Chinese track. 55 have unconfirmed Chinese captions, and one publisher explicitly states no Chinese subtitles. No CC option does not prove no burned-in text.

The complete 1–100 viewing order puts the 68 confirmed Chinese-accessible entries first. Eight Chinese-accessible starter videos form a shorter route. The six English Bhikkhu Bodhi lessons remain sequential in an optional branch. Full copyrighted transcripts are not included. The adjacent sources JSON records minimal observations and limitations.

## Validation and deployment

- 8 unit tests passed: catalogue evidence, replacements, caption distinctions, ordering, routes, filters, escaping and passthrough behavior.
- 42 native Worker checks passed, including exact existing-route response comparisons (per-request nonces normalized).
- Browser preview: 100 cards, 100 watch links, 100 ordered route items, 8 starter links; no horizontal overflow.
- Preserve the exact combined production baseline d446736e-8b05-4ce7-8ff7-edb45f74da8f (SHA256 7ddb6ced1f0492e81b65dc624feb4a34fb9ffd6e9d0dc58806b6ddabc4604d6a), its 22 bindings, assets and runtime settings.
- Catalogue-only overlay handles the video routes and passes all other responses through without rewriting navigation. Existing canon, practice, films, research and application routes are retained.
- Bundle uses whitespace minification only: identifier/syntax minification changes existing function-to-string output used by the application theme script.
- Verified release artifact SHA256: 6ce61bdcf24fb7b3024f4d7a8de6fc732628de4834ed4d1edfec3337b1de8456.
- Release tooling checks the live baseline before upload and publication, verifies the uploaded artifact and binding shape, and refuses to overwrite a newer production release.
